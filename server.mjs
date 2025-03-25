import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RouterOSAPI } from 'routeros-client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

import notificationRoutes from './api/notification_routes.mjs';

const execAsync = promisify(exec);

// Khởi tạo API MikroTik
class MikroTikAPI {
  constructor() {
    this.connected = false;
    this.connectionInfo = null;
    this.client = null;
  }

  async connect(address, port, username, password) {
    try {
      console.log(`Đang kết nối đến ${address}:${port} với user ${username}`);
      
      this.client = new RouterOSAPI({
        host: address,
        port: port,
        user: username,
        password: password,
        timeout: 5000,
      });

      await this.client.connect();
      this.connected = true;
      this.connectionInfo = { address, port, username, password };
      
      console.log('Kết nối thành công!');
      return true;
    } catch (error) {
      console.error('Lỗi kết nối:', error.message);
      this.connected = false;
      this.client = null;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        console.log('Đã ngắt kết nối');
      } catch (error) {
        console.error('Lỗi khi ngắt kết nối:', error.message);
      }
    }
    this.connected = false;
    this.client = null;
  }

  isConnected() {
    return this.connected && this.client !== null;
  }

  async getResourceInfo() {
    this.checkConnection();
    
    try {
      const resources = await this.client.write('/system/resource/print');
      const resource = resources[0];
      
      return {
        platform: resource.platform || 'Unknown',
        board: resource.board || 'Unknown',
        version: resource.version || 'Unknown',
        uptime: resource.uptime || '00:00:00',
        cpuLoad: resource['cpu-load'] || 0,
        totalMemory: parseInt(resource['total-memory'] || 0),
        freeMemory: parseInt(resource['free-memory'] || 0),
        totalHdd: parseInt(resource['total-hdd-space'] || 0),
        freeHdd: parseInt(resource['free-hdd-space'] || 0),
        architecture: resource.architecture || 'Unknown',
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin tài nguyên:', error.message);
      throw new Error('Không thể lấy thông tin tài nguyên: ' + error.message);
    }
  }

  async getInterfaces() {
    this.checkConnection();
    
    try {
      const interfaces = await this.client.write('/interface/print');
      
      return interfaces.map(iface => ({
        name: iface.name || 'Unknown',
        type: iface.type || 'Unknown',
        mtu: parseInt(iface.mtu || 0),
        actualMtu: parseInt(iface['actual-mtu'] || 0),
        macAddress: iface['mac-address'] || '',
        running: iface.running === 'true',
        disabled: iface.disabled === 'true',
        comment: iface.comment || '',
      }));
    } catch (error) {
      console.error('Lỗi khi lấy danh sách interface:', error.message);
      throw new Error('Không thể lấy danh sách interface: ' + error.message);
    }
  }

  checkConnection() {
    if (!this.isConnected()) {
      throw new Error('Không có kết nối đến router. Vui lòng kết nối trước.');
    }
  }
}

// Khởi tạo API
const mikrotikApi = new MikroTikAPI();

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Start monitoring service
let monitoringActive = false;

async function startMonitoringService() {
  try {
    // Kiểm tra xem python script đã được cài đặt chưa
    const monitorScript = path.join(__dirname, 'monitoring', 'alert_monitor.py');
    
    if (!fs.existsSync(monitorScript)) {
      console.error('Không tìm thấy script giám sát. Đảm bảo file monitoring/alert_monitor.py tồn tại.');
      return false;
    }
    
    console.log('Đang khởi động dịch vụ giám sát MikroTik...');
    
    // Chạy script trong nền
    const { stdout, stderr } = await execAsync(`python3 ${monitorScript} > logs/monitoring.log 2>&1 &`);
    
    if (stderr) {
      console.error('Lỗi khi khởi động dịch vụ giám sát:', stderr);
      return false;
    }
    
    console.log('Đã khởi động dịch vụ giám sát MikroTik thành công.');
    monitoringActive = true;
    return true;
  } catch (error) {
    console.error('Lỗi khi khởi động dịch vụ giám sát:', error.message);
    return false;
  }
}

// API để kiểm tra trạng thái giám sát
app.get('/api/monitoring/status', (req, res) => {
  res.json({ active: monitoringActive });
});

// API để khởi động dịch vụ giám sát
app.post('/api/monitoring/start', async (req, res) => {
  if (monitoringActive) {
    return res.status(400).json({ message: 'Dịch vụ giám sát đã đang chạy' });
  }
  
  const success = await startMonitoringService();
  
  if (success) {
    res.json({ message: 'Đã khởi động dịch vụ giám sát thành công' });
  } else {
    res.status(500).json({ message: 'Không thể khởi động dịch vụ giám sát' });
  }
});

// API để dừng dịch vụ giám sát
app.post('/api/monitoring/stop', async (req, res) => {
  if (!monitoringActive) {
    return res.status(400).json({ message: 'Dịch vụ giám sát không đang chạy' });
  }
  
  try {
    // Tìm và kết thúc tiến trình Python
    await execAsync("pkill -f 'python3.*alert_monitor.py'");
    
    monitoringActive = false;
    res.json({ message: 'Đã dừng dịch vụ giám sát thành công' });
  } catch (error) {
    console.error('Lỗi khi dừng dịch vụ giám sát:', error.message);
    res.status(500).json({ message: 'Không thể dừng dịch vụ giám sát', error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Mode: ${process.env.USE_REAL_MIKROTIK_API === 'true' ? 'REAL' : 'MOCK'} MikroTik API`);
  
  // Tạo thư mục logs nếu chưa tồn tại
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }
  
  // Thử khởi động dịch vụ giám sát
  try {
    await startMonitoringService();
  } catch (error) {
    console.error('Không thể khởi động dịch vụ giám sát tự động:', error.message);
  }
});