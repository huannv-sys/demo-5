import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRouterConnectionSchema, insertUserSchema } from "@shared/schema";
import { createMikroTikAPI } from "./mikrotik-api";
import session from "express-session";
import MemoryStore from "memorystore";
import { z } from "zod";
import { ZodError } from "zod-validation-error";

// Check if we're using real MikroTik API
const USE_REAL_API = process.env.USE_REAL_MIKROTIK_API === 'true';
console.log(`API Mode: ${USE_REAL_API ? 'REAL MikroTik API' : 'MOCK API'}`);

// Create router API instances cache
const routerApiCache = new Map();

// Initialize MikroTik API manager
const createOrGetRouterApi = (id: number) => {
  if (routerApiCache.has(id)) {
    return routerApiCache.get(id);
  }
  
  const api = createMikroTikAPI();
  routerApiCache.set(id, api);
  return api;
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up session middleware
  const MemoryStoreSession = MemoryStore(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'mikrotik-manager-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }, // 1 day
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // prune expired entries every 24h
    })
  }));

  // Middleware to check if user is authenticated
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Authentication Routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      // Validate request
      const data = await insertUserSchema.parseAsync(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(data.username);
      if (!user || user.password !== data.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Set user session
      req.session.userId = user.id;
      
      return res.status(200).json({ id: user.id, username: user.username });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  app.get("/api/auth/status", (req, res) => {
    if (req.session.userId) {
      return res.status(200).json({ authenticated: true });
    }
    return res.status(200).json({ authenticated: false });
  });

  // Router Connection Routes
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      const connections = await storage.getRouterConnections();
      // Don't send password in response
      const sanitizedConnections = connections.map(conn => ({
        ...conn,
        password: undefined
      }));
      return res.status(200).json(sanitizedConnections);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch connections" });
    }
  });
  
  app.post("/api/connections", requireAuth, async (req, res) => {
    try {
      const data = await insertRouterConnectionSchema.parseAsync(req.body);
      const connection = await storage.createRouterConnection(data);
      
      // Don't send password in response
      const { password, ...connectionWithoutPassword } = connection;
      
      return res.status(201).json(connectionWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create connection" });
    }
  });
  
  app.put("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }
      
      // Allow partial updates
      const data = req.body;
      const connection = await storage.updateRouterConnection(id, data);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Don't send password in response
      const { password, ...connectionWithoutPassword } = connection;
      
      return res.status(200).json(connectionWithoutPassword);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update connection" });
    }
  });
  
  app.delete("/api/connections/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }
      
      const success = await storage.deleteRouterConnection(id);
      
      if (!success) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Clean up router API instance if it exists
      if (routerApiCache.has(id)) {
        const api = routerApiCache.get(id);
        await api.disconnect();
        routerApiCache.delete(id);
      }
      
      return res.status(200).json({ message: "Connection deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete connection" });
    }
  });
  
  app.post("/api/connections/:id/connect", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }
      
      const connection = await storage.getRouterConnection(id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Check if we already have an active connection
      if (routerApiCache.has(id)) {
        const existingApi = routerApiCache.get(id);
        if (existingApi.isConnected()) {
          // Already connected, no need to reconnect
          return res.status(200).json({ message: "Already connected" });
        }
        // Disconnect first if it exists but not connected properly
        await existingApi.disconnect();
      }
      
      const api = createOrGetRouterApi(id);
      
      try {
        const connected = await api.connect(
          connection.address, 
          connection.port, 
          connection.username, 
          connection.password
        );
        
        if (!connected) {
          return res.status(500).json({ message: "Failed to connect to router" });
        }
        
        // Update last connected timestamp
        await storage.updateRouterConnection(id, { lastConnected: new Date() });
        
        return res.status(200).json({ message: "Connected successfully" });
      } catch (connectError) {
        const errorMessage = connectError instanceof Error ? connectError.message : 'Unknown error';
        return res.status(401).json({ message: `Authentication failed: ${errorMessage}` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ message: `Failed to connect: ${errorMessage}` });
    }
  });
  
  app.post("/api/connections/:id/disconnect", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }
      
      if (!routerApiCache.has(id)) {
        // If not in cache, consider it already disconnected
        return res.status(200).json({ message: "Not connected" });
      }
      
      try {
        const api = routerApiCache.get(id);
        await api.disconnect();
        routerApiCache.delete(id); // Remove from cache after disconnecting
        
        return res.status(200).json({ message: "Disconnected successfully" });
      } catch (disconnectError) {
        const errorMessage = disconnectError instanceof Error ? disconnectError.message : 'Unknown error';
        console.error(`Error during disconnect: ${errorMessage}`);
        
        // Still remove from cache even if disconnect fails
        routerApiCache.delete(id);
        return res.status(200).json({ message: "Force disconnected due to error" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ message: `Failed to disconnect: ${errorMessage}` });
    }
  });
  
  app.get("/api/connections/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }
      
      const connection = await storage.getRouterConnection(id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      let isConnected = false;
      if (routerApiCache.has(id)) {
        const api = routerApiCache.get(id);
        isConnected = api.isConnected();
      }
      
      return res.status(200).json({ 
        connected: isConnected,
        lastConnected: connection.lastConnected
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to get connection status" });
    }
  });
  
  // Router API Routes
  
  // Resource Info
  app.get("/api/connections/:id/resources", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const resourceInfo = await api.getResourceInfo();
      
      return res.status(200).json(resourceInfo);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get resource info: ${error.message}` });
    }
  });
  
  // Interfaces
  app.get("/api/connections/:id/interfaces", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const interfaces = await api.getInterfaces();
      
      return res.status(200).json(interfaces);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get interfaces: ${error.message}` });
    }
  });
  
  // Wireless
  app.get("/api/connections/:id/wireless", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const wireless = await api.getWirelessNetworks();
      
      return res.status(200).json(wireless);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get wireless networks: ${error.message}` });
    }
  });
  
  app.get("/api/connections/:id/wireless/clients", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const clients = await api.getWirelessClients();
      
      return res.status(200).json(clients);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get wireless clients: ${error.message}` });
    }
  });
  
  // Firewall
  app.get("/api/connections/:id/firewall", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const chain = req.query.chain as string | undefined;
      const rules = await api.getFirewallRules(chain);
      
      return res.status(200).json(rules);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get firewall rules: ${error.message}` });
    }
  });
  
  // Routing
  app.get("/api/connections/:id/routing", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const routes = await api.getRoutingRules();
      
      return res.status(200).json(routes);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get routing rules: ${error.message}` });
    }
  });
  
  // ARP
  app.get("/api/connections/:id/arp", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const arpEntries = await api.getArpEntries();
      
      return res.status(200).json(arpEntries);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get ARP entries: ${error.message}` });
    }
  });
  
  // Logs
  app.get("/api/connections/:id/logs", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await api.getLogs(limit);
      
      return res.status(200).json(logs);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get logs: ${error.message}` });
    }
  });
  
  // Users
  app.get("/api/connections/:id/users", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const users = await api.getUsers();
      
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get users: ${error.message}` });
    }
  });
  
  // DHCP
  app.get("/api/connections/:id/dhcp/leases", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const api = routerApiCache.get(id);
      const leases = await api.getDhcpLeases();
      
      return res.status(200).json(leases);
    } catch (error) {
      return res.status(500).json({ message: `Failed to get DHCP leases: ${error.message}` });
    }
  });
  
  // Execute command (carefully limited in production)
  app.post("/api/connections/:id/command", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid router ID" });
      }
      
      if (!routerApiCache.has(id)) {
        return res.status(400).json({ message: "Router not connected" });
      }
      
      const { command } = req.body;
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }
      
      const api = routerApiCache.get(id);
      const result = await api.executeCommand(command);
      
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: `Failed to execute command: ${error.message}` });
    }
  });

  return httpServer;
}
