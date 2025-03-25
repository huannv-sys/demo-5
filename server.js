const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const mikrotikApi = require('./mikrotik-api');

// Load environment variables
dotenv.config();

// Init app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static('public'));

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'API is running', time: new Date().toISOString() });
});

// Router Connection Routes
app.get('/api/connections', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'ICTech Router',
      address: '113.22.135.94',
      port: 8728,
      username: 'admin',
      isDefault: true,
      lastConnected: new Date().toISOString()
    }
  ]);
});

// Create new connection
app.post('/api/connections', async (req, res) => {
  try {
    const { name, address, port, username, password, isDefault } = req.body;
    
    // Validate input
    if (!name || !address || !username || !password) {
      return res.status(400).json({ 
        message: "Missing required fields. Please provide name, address, username, and password."
      });
    }

    // Try to connect to router
    const connected = await mikrotikApi.connect(address, parseInt(port) || 8728, username, password);
    
    if (connected) {
      // Disconnect after successful test
      await mikrotikApi.disconnect();
      
      // Return success with demo ID (would be from database in production)
      res.status(201).json({
        id: Date.now(),
        name,
        address,
        port: parseInt(port) || 8728,
        username,
        isDefault: isDefault || false,
        lastConnected: new Date().toISOString()
      });
    } else {
      res.status(400).json({ message: "Failed to connect to router. Check credentials and router availability." });
    }
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ message: "An error occurred while creating the connection.", error: error.message });
  }
});

// Connect to router
app.post('/api/connections/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In production, would fetch these from database
    const routerInfo = {
      address: '113.22.135.94',
      port: 8728,
      username: 'admin',
      password: 'Ictech123$'
    };
    
    const connected = await mikrotikApi.connect(
      routerInfo.address, 
      routerInfo.port, 
      routerInfo.username, 
      routerInfo.password
    );
    
    if (connected) {
      res.json({ message: "Connected successfully", routerId: id });
    } else {
      res.status(400).json({ message: "Failed to connect to router", routerId: id });
    }
  } catch (error) {
    console.error('Error connecting to router:', error);
    res.status(500).json({ message: "An error occurred while connecting to the router", error: error.message });
  }
});

// Get resources info
app.get('/api/connections/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const resources = await mikrotikApi.getResourceInfo();
    res.json(resources);
  } catch (error) {
    console.error('Error getting resource info:', error);
    res.status(500).json({ message: "An error occurred while getting resource info", error: error.message });
  }
});

// Get interfaces
app.get('/api/connections/:id/interfaces', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      // Thử kết nối tự động
      const routerInfo = {
        address: '113.22.135.94',
        port: 8728,
        username: 'admin',
        password: 'Ictech123$'
      };
      
      const connected = await mikrotikApi.connect(
        routerInfo.address, 
        routerInfo.port, 
        routerInfo.username, 
        routerInfo.password
      );
      
      if (!connected) {
        return res.status(400).json({ message: "Not connected to router" });
      }
    }
    
    const interfaces = await mikrotikApi.getInterfaces();
    res.json(interfaces);
  } catch (error) {
    console.error('Error getting interfaces:', error);
    res.status(500).json({ message: "An error occurred while getting interfaces", error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Mode: ${process.env.USE_REAL_MIKROTIK_API === 'true' ? 'REAL' : 'MOCK'} MikroTik API`);
});