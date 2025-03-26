const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const mikrotikApi = require('./mikrotik-api.cjs');

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

// Test MikroTik connection
app.get('/api/test-mikrotik-connection', async (req, res) => {
  try {
    console.log("Đang kiểm tra kết nối MikroTik...");
    
    // Ngắt kết nối hiện tại nếu có
    if (mikrotikApi.isConnected()) {
      await mikrotikApi.disconnect();
    }
    
    // Lấy thông tin kết nối từ biến môi trường
    const routerInfo = {
      address: process.env.MIKROTIK_ADDRESS || 'localhost',
      port: parseInt(process.env.MIKROTIK_PORT || '8728'),
      username: process.env.MIKROTIK_USERNAME || '',
      password: process.env.MIKROTIK_PASSWORD || ''
    };
    
    console.log('Thông tin kết nối router (test):', {
      address: routerInfo.address,
      port: routerInfo.port,
      username: routerInfo.username,
      passwordLength: routerInfo.password ? routerInfo.password.length : 0
    });
    
    // Thử kết nối
    const connected = await mikrotikApi.connect(
      routerInfo.address, 
      routerInfo.port, 
      routerInfo.username, 
      routerInfo.password
    );
    
    if (connected) {
      // Lấy thông tin cơ bản
      const resources = await mikrotikApi.getResourceInfo();
      console.log("Kết nối thành công! Thông tin hệ thống:", resources);
      
      res.json({
        success: true,
        message: "Kết nối thành công!",
        routerInfo: {
          platform: resources.platform,
          board: resources.board,
          version: resources.version,
          uptime: resources.uptime
        }
      });
    } else {
      console.log("Kết nối thất bại!");
      res.status(400).json({
        success: false,
        message: "Không thể kết nối đến MikroTik Router. Kiểm tra lại thông tin đăng nhập và kết nối mạng."
      });
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra kết nối:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi kiểm tra kết nối",
      error: error.message
    });
  }
});

// Router Connection Routes
app.get('/api/connections', (req, res) => {
  // Đọc từ cấu hình hoặc database thay vì hardcode
  const routerAddress = process.env.MIKROTIK_ADDRESS || 'localhost';
  const routerPort = parseInt(process.env.MIKROTIK_PORT || '8728');
  const routerUsername = process.env.MIKROTIK_USERNAME || '';
  const routerName = process.env.MIKROTIK_NAME || 'MikroTik Router';
  
  res.json([
    {
      id: 1,
      name: routerName,
      address: routerAddress,
      port: routerPort,
      username: routerUsername,
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
    
    console.log(`Đang cố gắng kết nối đến router ID: ${id}`);
    
    // Disconnect if already connected
    if (mikrotikApi.isConnected()) {
      console.log('Phát hiện kết nối hiện tại, đang ngắt kết nối...');
      await mikrotikApi.disconnect();
    }
    
    // Lấy thông tin từ biến môi trường thay vì hardcode
    const routerInfo = {
      address: process.env.MIKROTIK_ADDRESS || 'localhost',
      port: parseInt(process.env.MIKROTIK_PORT || '8728'),
      username: process.env.MIKROTIK_USERNAME || '',
      password: process.env.MIKROTIK_PASSWORD || ''
    };
    
    console.log('Thông tin kết nối router:', {
      address: routerInfo.address,
      port: routerInfo.port,
      username: routerInfo.username,
      passwordLength: routerInfo.password ? routerInfo.password.length : 0
    });
    
    // Kiểm tra xem thông tin đăng nhập có đầy đủ không
    if (!routerInfo.username || !routerInfo.password) {
      console.log('Thiếu thông tin đăng nhập router');
      return res.status(400).json({ 
        message: "Missing router credentials. Please check environment variables."
      });
    }
    
    console.log('Bắt đầu kết nối đến router...');
    const connected = await mikrotikApi.connect(
      routerInfo.address, 
      routerInfo.port, 
      routerInfo.username, 
      routerInfo.password
    );
    
    if (connected) {
      console.log('Kết nối thành công đến router!');
      res.json({ message: "Connected successfully", routerId: id });
    } else {
      console.log('Kết nối thất bại');
      res.status(400).json({ message: "Failed to connect to router", routerId: id });
    }
  } catch (error) {
    console.error('Lỗi khi kết nối đến router:', error);
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
      // Thử kết nối tự động sử dụng biến môi trường
      const routerInfo = {
        address: process.env.MIKROTIK_ADDRESS || 'localhost',
        port: parseInt(process.env.MIKROTIK_PORT || '8728'),
        username: process.env.MIKROTIK_USERNAME || '',
        password: process.env.MIKROTIK_PASSWORD || ''
      };
      
      // Kiểm tra thông tin đăng nhập trước khi kết nối
      if (!routerInfo.username || !routerInfo.password) {
        return res.status(400).json({ 
          message: "Missing router credentials. Please check environment variables."
        });
      }
      
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