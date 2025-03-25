import { 
  type User, 
  type InsertUser, 
  type RouterConnection, 
  type InsertRouterConnection,
  type LogEntry,
  type InsertLogEntry
} from "@shared/schema";

// Extend the storage interface with methods for router connections
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Router connection methods
  getRouterConnection(id: number): Promise<RouterConnection | undefined>;
  getRouterConnections(): Promise<RouterConnection[]>;
  getDefaultRouterConnection(): Promise<RouterConnection | undefined>;
  createRouterConnection(connection: InsertRouterConnection): Promise<RouterConnection>;
  updateRouterConnection(id: number, connection: Partial<InsertRouterConnection>): Promise<RouterConnection | undefined>;
  deleteRouterConnection(id: number): Promise<boolean>;
  setDefaultRouterConnection(id: number): Promise<RouterConnection | undefined>;

  // Log entry methods
  getLogEntries(routerId: number, limit?: number): Promise<LogEntry[]>;
  createLogEntry(entry: InsertLogEntry): Promise<LogEntry>;
  clearLogEntries(routerId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private routerConnections: Map<number, RouterConnection>;
  private logEntries: Map<number, LogEntry[]>;
  currentId: number;
  currentRouterId: number;
  currentLogId: number;

  constructor() {
    this.users = new Map();
    this.routerConnections = new Map();
    this.logEntries = new Map();
    this.currentId = 1;
    this.currentRouterId = 1;
    this.currentLogId = 1;

    // Initialize with default admin user
    this.createUser({
      username: "admin",
      password: "admin" // In a real app, this would be hashed
    });

    // Add a default router connection for demo purposes
    this.createRouterConnection({
      name: "RouterBoard 3011",
      address: "192.168.1.1",
      port: 8728,
      username: "admin",
      password: "password",
      isDefault: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Router connection methods
  async getRouterConnection(id: number): Promise<RouterConnection | undefined> {
    return this.routerConnections.get(id);
  }

  async getRouterConnections(): Promise<RouterConnection[]> {
    return Array.from(this.routerConnections.values());
  }

  async getDefaultRouterConnection(): Promise<RouterConnection | undefined> {
    return Array.from(this.routerConnections.values()).find(
      (connection) => connection.isDefault === true
    );
  }

  async createRouterConnection(insertConnection: InsertRouterConnection): Promise<RouterConnection> {
    const id = this.currentRouterId++;
    
    // If this is the first connection or set as default, make all others non-default
    if (insertConnection.isDefault || this.routerConnections.size === 0) {
      for (const [connId, connection] of this.routerConnections.entries()) {
        this.routerConnections.set(connId, { ...connection, isDefault: false });
      }
    }
    
    const connection: RouterConnection = { 
      ...insertConnection, 
      id, 
      createdAt: new Date(), 
      lastConnected: undefined
    };
    
    this.routerConnections.set(id, connection);
    return connection;
  }

  async updateRouterConnection(id: number, updateData: Partial<InsertRouterConnection>): Promise<RouterConnection | undefined> {
    const connection = this.routerConnections.get(id);
    if (!connection) return undefined;

    // If setting as default, make all others non-default
    if (updateData.isDefault) {
      for (const [connId, conn] of this.routerConnections.entries()) {
        if (connId !== id) {
          this.routerConnections.set(connId, { ...conn, isDefault: false });
        }
      }
    }

    const updatedConnection = { ...connection, ...updateData };
    this.routerConnections.set(id, updatedConnection);
    return updatedConnection;
  }

  async deleteRouterConnection(id: number): Promise<boolean> {
    const deleted = this.routerConnections.delete(id);
    
    // If we deleted the default connection and others exist, set a new default
    if (deleted) {
      const connections = Array.from(this.routerConnections.values());
      if (connections.length > 0 && !connections.some(c => c.isDefault)) {
        this.routerConnections.set(connections[0].id, { ...connections[0], isDefault: true });
      }
    }
    
    return deleted;
  }

  async setDefaultRouterConnection(id: number): Promise<RouterConnection | undefined> {
    return this.updateRouterConnection(id, { isDefault: true });
  }

  // Log entry methods
  async getLogEntries(routerId: number, limit?: number): Promise<LogEntry[]> {
    const entries = this.logEntries.get(routerId) || [];
    if (limit) {
      return entries.slice(-limit);
    }
    return entries;
  }

  async createLogEntry(entry: InsertLogEntry): Promise<LogEntry> {
    const id = this.currentLogId++;
    const logEntry: LogEntry = { ...entry, id, createdAt: new Date() };
    
    if (!this.logEntries.has(entry.routerId)) {
      this.logEntries.set(entry.routerId, []);
    }
    
    const routerLogs = this.logEntries.get(entry.routerId)!;
    routerLogs.push(logEntry);
    
    // Keep only the last 1000 logs per router
    if (routerLogs.length > 1000) {
      const newLogs = routerLogs.slice(-1000);
      this.logEntries.set(entry.routerId, newLogs);
    }
    
    return logEntry;
  }

  async clearLogEntries(routerId: number): Promise<boolean> {
    this.logEntries.set(routerId, []);
    return true;
  }
}

export const storage = new MemStorage();
