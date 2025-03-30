const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const mikrotikApi = require('./mikrotik-api.cjs');

// Load environment variables
dotenv.config();

// Global variables for connection state
let activeConnectionId = null;
let router_connections = [];

// Init app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// MIME types
app.use((req, res, next) => {
  if (req.path.endsWith('.svg')) {
    res.setHeader('Content-Type', 'image/svg+xml');
  }
  next();
});

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

// Get interface statistics
app.get('/api/connections/:id/interface-stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const stats = await mikrotikApi.getInterfaceStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting interface statistics:', error);
    res.status(500).json({ message: "An error occurred while getting interface statistics", error: error.message });
  }
});

// Get wireless information
app.get('/api/connections/:id/wireless', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const wirelessInfo = await mikrotikApi.getWirelessInfo();
    res.json(wirelessInfo);
  } catch (error) {
    console.error('Error getting wireless information:', error);
    res.status(500).json({ message: "An error occurred while getting wireless information", error: error.message });
  }
});

// Get DHCP information
app.get('/api/connections/:id/dhcp', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const dhcpInfo = await mikrotikApi.getDHCPInfo();
    res.json(dhcpInfo);
  } catch (error) {
    console.error('Error getting DHCP information:', error);
    res.status(500).json({ message: "An error occurred while getting DHCP information", error: error.message });
  }
});

// Get firewall rules
app.get('/api/connections/:id/firewall', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const firewallRules = await mikrotikApi.getFirewallRules();
    res.json(firewallRules);
  } catch (error) {
    console.error('Error getting firewall rules:', error);
    res.status(500).json({ message: "An error occurred while getting firewall rules", error: error.message });
  }
});

// Get VPN information
app.get('/api/connections/:id/vpn', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const vpnInfo = await mikrotikApi.getVPNInfo();
    res.json(vpnInfo);
  } catch (error) {
    console.error('Error getting VPN information:', error);
    res.status(500).json({ message: "An error occurred while getting VPN information", error: error.message });
  }
});

// Get logs
app.get('/api/connections/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const logs = await mikrotikApi.getLogs(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ message: "An error occurred while getting logs", error: error.message });
  }
});

// New API endpoints for the SPA interface
// Get router connection status
app.get('/api/router/status', async (req, res) => {
  try {
    const isConnected = mikrotikApi.isConnected();
    
    // If connected, return the connection details (without password)
    let connectionDetails = null;
    if (isConnected && activeConnectionId) {
      const activeConnection = router_connections.find(conn => conn.id === activeConnectionId);
      if (activeConnection) {
        // Clone the connection object without the password
        connectionDetails = { 
          id: activeConnection.id,
          name: activeConnection.name,
          address: activeConnection.address,
          port: activeConnection.port,
          username: activeConnection.username
        };
      }
    }
    
    res.json({ 
      success: true, 
      connected: isConnected,
      connection: connectionDetails
    });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ success: false, message: 'Error checking connection status', error: error.message });
  }
});

// Connect to a router (create a new connection if needed)
app.post('/api/router/connect', async (req, res) => {
  try {
    const { address, port, username, password, name } = req.body;
    
    // Validate required fields
    if (!address || !username) {
      return res.status(400).json({ success: false, message: 'Address and username are required' });
    }
    
    // First disconnect from any existing connection
    if (mikrotikApi.isConnected()) {
      await mikrotikApi.disconnect();
      activeConnectionId = null;
    }
    
    // Attempt to connect
    const connected = await mikrotikApi.connect(address, port || 8728, username, password);
    
    if (!connected) {
      return res.status(400).json({ success: false, message: 'Failed to connect to the router' });
    }
    
    // Create a new connection entry or update existing one
    let connectionId;
    const existingConnection = router_connections.find(conn => 
      conn.address === address && conn.port === port && conn.username === username
    );
    
    if (existingConnection) {
      // Update existing connection
      existingConnection.last_connected = new Date().toISOString();
      connectionId = existingConnection.id;
    } else {
      // Create new connection
      const newId = router_connections.length > 0 
        ? Math.max(...router_connections.map(conn => conn.id)) + 1 
        : 1;
        
      const newConnection = {
        id: newId,
        name: name || `Router at ${address}`,
        address,
        port: port || 8728,
        username,
        password: password ? '[ENCRYPTED]' : null,  // In a real app, encrypt this
        last_connected: new Date().toISOString()
      };
      
      router_connections.push(newConnection);
      connectionId = newId;
    }
    
    // Set as active connection
    activeConnectionId = connectionId;
    
    res.json({ 
      success: true, 
      message: 'Connected successfully',
      connectionId 
    });
  } catch (error) {
    console.error('Error connecting to router:', error);
    res.status(500).json({ success: false, message: 'Error connecting to router', error: error.message });
  }
});

// Disconnect from router
app.post('/api/router/disconnect', async (req, res) => {
  try {
    if (mikrotikApi.isConnected()) {
      await mikrotikApi.disconnect();
      activeConnectionId = null;
      
      res.json({ success: true, message: 'Disconnected successfully' });
    } else {
      res.json({ success: true, message: 'Not connected' });
    }
  } catch (error) {
    console.error('Error disconnecting from router:', error);
    res.status(500).json({ success: false, message: 'Error disconnecting from router', error: error.message });
  }
});

// Get router resources for the SPA interface
app.get('/api/router/resources', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const resources = await mikrotikApi.getResourceInfo();
    
    res.json({ 
      success: true, 
      data: resources
    });
  } catch (error) {
    console.error('Error getting router resources:', error);
    res.status(500).json({ success: false, message: 'Error getting router resources', error: error.message });
  }
});

// Get router interfaces for the SPA interface
app.get('/api/router/interfaces', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const interfaces = await mikrotikApi.getInterfaces();
    
    res.json({ 
      success: true, 
      data: interfaces
    });
  } catch (error) {
    console.error('Error getting router interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting router interfaces', error: error.message });
  }
});

// Get wireless interfaces
app.get('/api/router/wireless/interfaces', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const wirelessInterfaces = await mikrotikApi.executeCommand('/interface/wireless/print');
    
    res.json({ 
      success: true, 
      data: wirelessInterfaces
    });
  } catch (error) {
    console.error('Error getting wireless interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting wireless interfaces', error: error.message });
  }
});

// Get wireless registrations
app.get('/api/router/wireless/registration-table', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const registrations = await mikrotikApi.executeCommand('/interface/wireless/registration-table/print');
    
    res.json({ 
      success: true, 
      data: registrations
    });
  } catch (error) {
    console.error('Error getting wireless registrations:', error);
    res.status(500).json({ success: false, message: 'Error getting wireless registrations', error: error.message });
  }
});

// Start wireless scan
app.post('/api/router/wireless/scan', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const result = await mikrotikApi.executeCommand('/interface/wireless/scan', [], { command: 'start' });
    
    res.json({ 
      success: true, 
      message: 'Scan started'
    });
  } catch (error) {
    console.error('Error starting wireless scan:', error);
    res.status(500).json({ success: false, message: 'Error starting wireless scan', error: error.message });
  }
});

// Get wireless scan results
app.get('/api/router/wireless/scan-results', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const scanResults = await mikrotikApi.executeCommand('/interface/wireless/scan', [], { command: 'print' });
    
    res.json({ 
      success: true, 
      data: scanResults
    });
  } catch (error) {
    console.error('Error getting wireless scan results:', error);
    res.status(500).json({ success: false, message: 'Error getting wireless scan results', error: error.message });
  }
});

// Get CAPsMAN interfaces
app.get('/api/router/capsman/interfaces', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const capsmanInterfaces = await mikrotikApi.executeCommand('/caps-man/interface/print');
    
    res.json({ 
      success: true, 
      data: capsmanInterfaces
    });
  } catch (error) {
    console.error('Error getting CAPsMAN interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN interfaces', error: error.message });
  }
});

// Get CAPsMAN registered access points
app.get('/api/router/capsman/access-points', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const capsmanAPs = await mikrotikApi.executeCommand('/caps-man/registration-table/print');
    
    res.json({ 
      success: true, 
      data: capsmanAPs
    });
  } catch (error) {
    console.error('Error getting CAPsMAN access points:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN access points', error: error.message });
  }
});

// Get CAPsMAN configurations
app.get('/api/router/capsman/configurations', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const configurations = await mikrotikApi.executeCommand('/caps-man/configuration/print');
    
    res.json({ 
      success: true, 
      data: configurations
    });
  } catch (error) {
    console.error('Error getting CAPsMAN configurations:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN configurations', error: error.message });
  }
});

// Get CAPsMAN channels
app.get('/api/router/capsman/channels', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const channels = await mikrotikApi.executeCommand('/caps-man/channel/print');
    
    res.json({ 
      success: true, 
      data: channels
    });
  } catch (error) {
    console.error('Error getting CAPsMAN channels:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN channels', error: error.message });
  }
});

// Get CAPsMAN security configs
app.get('/api/router/capsman/security', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const security = await mikrotikApi.executeCommand('/caps-man/security/print');
    
    res.json({ 
      success: true, 
      data: security
    });
  } catch (error) {
    console.error('Error getting CAPsMAN security configs:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN security configs', error: error.message });
  }
});

// Get CAPsMAN connected clients
app.get('/api/router/capsman/clients', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    // Trên một số phiên bản RouterOS, lệnh client có thể không tồn tại
    // Thay vào đó, chúng ta có thể sử dụng dữ liệu từ registration-table
    let clients = [];
    try {
      clients = await mikrotikApi.executeCommand('/caps-man/client/print');
    } catch (clientError) {
      console.log('Không thể truy cập lệnh /caps-man/client/print, sẽ dùng registration-table thay thế');
      try {
        // Sử dụng registration-table để lấy thông tin clients
        const registrations = await mikrotikApi.executeCommand('/caps-man/registration-table/print');
        // Chuyển đổi dữ liệu từ registration-table sang định dạng client
        clients = registrations.map(reg => ({
          mac_address: reg.mac_address || '',
          interface: reg.interface || '',
          rx_signal: reg.rx_signal || '',
          tx_rate: reg.tx_rate || '',
          rx_rate: reg.rx_rate || '',
          uptime: reg.uptime || '',
          // Thêm các trường khác nếu cần
        }));
      } catch (regError) {
        console.error('Không thể lấy dữ liệu từ registration-table:', regError);
        clients = []; // Mảng trống nếu cả hai cách đều thất bại
      }
    }
    
    res.json({ 
      success: true, 
      data: clients
    });
  } catch (error) {
    console.error('Error getting CAPsMAN clients:', error);
    res.status(500).json({ success: false, message: 'Error getting CAPsMAN clients', error: error.message });
  }
});

// Get firewall filter rules
app.get('/api/router/firewall/filter', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const filterRules = await mikrotikApi.executeCommand('/ip/firewall/filter/print');
    
    res.json({ 
      success: true, 
      data: filterRules
    });
  } catch (error) {
    console.error('Error getting firewall filter rules:', error);
    res.status(500).json({ success: false, message: 'Error getting firewall filter rules', error: error.message });
  }
});

// Get firewall NAT rules
app.get('/api/router/firewall/nat', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const natRules = await mikrotikApi.executeCommand('/ip/firewall/nat/print');
    
    res.json({ 
      success: true, 
      data: natRules
    });
  } catch (error) {
    console.error('Error getting firewall NAT rules:', error);
    res.status(500).json({ success: false, message: 'Error getting firewall NAT rules', error: error.message });
  }
});

// Get firewall mangle rules
app.get('/api/router/firewall/mangle', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const mangleRules = await mikrotikApi.executeCommand('/ip/firewall/mangle/print');
    
    res.json({ 
      success: true, 
      data: mangleRules
    });
  } catch (error) {
    console.error('Error getting firewall mangle rules:', error);
    res.status(500).json({ success: false, message: 'Error getting firewall mangle rules', error: error.message });
  }
});

// Get DHCP servers
app.get('/api/router/dhcp/servers', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const dhcpServers = await mikrotikApi.executeCommand('/ip/dhcp-server/print');
    
    res.json({ 
      success: true, 
      data: dhcpServers
    });
  } catch (error) {
    console.error('Error getting DHCP servers:', error);
    res.status(500).json({ success: false, message: 'Error getting DHCP servers', error: error.message });
  }
});

// Get DHCP leases
app.get('/api/router/dhcp/leases', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const dhcpLeases = await mikrotikApi.executeCommand('/ip/dhcp-server/lease/print');
    
    res.json({ 
      success: true, 
      data: dhcpLeases
    });
  } catch (error) {
    console.error('Error getting DHCP leases:', error);
    res.status(500).json({ success: false, message: 'Error getting DHCP leases', error: error.message });
  }
});

// Get DHCP networks
app.get('/api/router/dhcp/networks', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const dhcpNetworks = await mikrotikApi.executeCommand('/ip/dhcp-server/network/print');
    
    res.json({ 
      success: true, 
      data: dhcpNetworks
    });
  } catch (error) {
    console.error('Error getting DHCP networks:', error);
    res.status(500).json({ success: false, message: 'Error getting DHCP networks', error: error.message });
  }
});

// Get logs with optional filtering
app.get('/api/router/logs', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const topics = req.query.topics || null;
    
    let command = '/log/print';
    let logs = [];
    
    try {
      // Thử truy vấn không sử dụng tham số limit
      logs = await mikrotikApi.executeCommand(command, [], {});
      
      // Lọc theo topic nếu cần
      if (topics) {
        logs = logs.filter(log => log.topics && log.topics.includes(topics));
      }
      
      // Giới hạn kết quả
      logs = logs.slice(0, limit);
    } catch (secondError) {
      console.error('Không thể lấy log:', secondError);
      logs = [];
    }
    
    res.json({ 
      success: true, 
      data: logs
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ success: false, message: 'Error getting logs', error: error.message });
  }
});

// Get VPN interfaces (PPPoE)
app.get('/api/router/vpn/pppoe', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const pppoeInterfaces = await mikrotikApi.executeCommand('/interface/pppoe-client/print');
    
    res.json({ 
      success: true, 
      data: pppoeInterfaces
    });
  } catch (error) {
    console.error('Error getting PPPoE interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting PPPoE interfaces', error: error.message });
  }
});

// Get VPN interfaces (L2TP)
app.get('/api/router/vpn/l2tp', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const l2tpInterfaces = await mikrotikApi.executeCommand('/interface/l2tp-client/print');
    
    res.json({ 
      success: true, 
      data: l2tpInterfaces
    });
  } catch (error) {
    console.error('Error getting L2TP interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting L2TP interfaces', error: error.message });
  }
});

// Get VPN interfaces (PPTP)
app.get('/api/router/vpn/pptp', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const pptpInterfaces = await mikrotikApi.executeCommand('/interface/pptp-client/print');
    
    res.json({ 
      success: true, 
      data: pptpInterfaces
    });
  } catch (error) {
    console.error('Error getting PPTP interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting PPTP interfaces', error: error.message });
  }
});

// Get VPN interfaces (OpenVPN)
app.get('/api/router/vpn/ovpn', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const ovpnInterfaces = await mikrotikApi.executeCommand('/interface/ovpn-client/print');
    
    res.json({ 
      success: true, 
      data: ovpnInterfaces
    });
  } catch (error) {
    console.error('Error getting OpenVPN interfaces:', error);
    res.status(500).json({ success: false, message: 'Error getting OpenVPN interfaces', error: error.message });
  }
});

// Get VPN secrets
app.get('/api/router/vpn/secrets', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const vpnSecrets = await mikrotikApi.executeCommand('/ppp/secret/print');
    
    res.json({ 
      success: true, 
      data: vpnSecrets
    });
  } catch (error) {
    console.error('Error getting VPN secrets:', error);
    res.status(500).json({ success: false, message: 'Error getting VPN secrets', error: error.message });
  }
});

// Get active VPN connections
app.get('/api/router/vpn/active', async (req, res) => {
  try {
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ success: false, message: 'Not connected to router' });
    }
    
    const activeConnections = await mikrotikApi.executeCommand('/ppp/active/print');
    
    res.json({ 
      success: true, 
      data: activeConnections
    });
  } catch (error) {
    console.error('Error getting active VPN connections:', error);
    res.status(500).json({ success: false, message: 'Error getting active VPN connections', error: error.message });
  }
});

// Get notification config
app.get('/api/notifications/config', async (req, res) => {
  try {
    // Get configuration from notification service
    const configFile = path.join(__dirname, 'config', 'notification_config.json');
    let config = {};
    
    try {
      if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, 'utf8');
        config = JSON.parse(configData);
      } else {
        // Create default config
        config = {
          enabled: true,
          email: {
            enabled: false,
            recipients: []
          },
          sms: {
            enabled: false,
            recipients: []
          },
          thresholds: {
            cpu: 80,
            memory: 80,
            disk: 85,
            bandwidth: 75
          }
        };
        
        // Create config directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'config'))) {
          fs.mkdirSync(path.join(__dirname, 'config'), { recursive: true });
        }
        
        // Save default config
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
      }
    } catch (error) {
      console.error('Error reading/writing notification config:', error);
      // Return a default config on error
      config = {
        enabled: true,
        email: {
          enabled: false,
          recipients: []
        },
        sms: {
          enabled: false,
          recipients: []
        },
        thresholds: {
          cpu: 80,
          memory: 80,
          disk: 85,
          bandwidth: 75
        }
      };
    }
    
    res.json({ 
      success: true, 
      data: config
    });
  } catch (error) {
    console.error('Error getting notification config:', error);
    res.status(500).json({ success: false, message: 'Error getting notification config', error: error.message });
  }
});

// Update notification config
app.post('/api/notifications/config', async (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate config
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid configuration format' });
    }
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'config'))) {
      fs.mkdirSync(path.join(__dirname, 'config'), { recursive: true });
    }
    
    // Read current config
    const configFile = path.join(__dirname, 'config', 'notification_config.json');
    let currentConfig = {};
    
    try {
      if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, 'utf8');
        currentConfig = JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error reading current notification config:', error);
      // Continue with empty config
    }
    
    // Merge configs
    const updatedConfig = {
      ...currentConfig,
      ...newConfig,
      // Preserve thresholds if not provided
      thresholds: {
        ...(currentConfig.thresholds || {}),
        ...(newConfig.thresholds || {})
      }
    };
    
    // Save updated config
    fs.writeFileSync(configFile, JSON.stringify(updatedConfig, null, 2), 'utf8');
    
    res.json({ 
      success: true, 
      message: 'Notification configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating notification config:', error);
    res.status(500).json({ success: false, message: 'Error updating notification config', error: error.message });
  }
});

// Update alert thresholds
app.post('/api/notifications/alert-config', async (req, res) => {
  try {
    const { thresholds } = req.body;
    
    // Validate thresholds
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid thresholds format' });
    }
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'config'))) {
      fs.mkdirSync(path.join(__dirname, 'config'), { recursive: true });
    }
    
    // Read current config
    const configFile = path.join(__dirname, 'config', 'notification_config.json');
    let currentConfig = {};
    
    try {
      if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, 'utf8');
        currentConfig = JSON.parse(configData);
      }
    } catch (error) {
      console.error('Error reading current notification config:', error);
      // Create a new config with default values
      currentConfig = {
        enabled: true,
        email: {
          enabled: false,
          recipients: []
        },
        sms: {
          enabled: false,
          recipients: []
        },
        thresholds: {}
      };
    }
    
    // Update thresholds
    currentConfig.thresholds = {
      ...(currentConfig.thresholds || {}),
      ...thresholds
    };
    
    // Save updated config
    fs.writeFileSync(configFile, JSON.stringify(currentConfig, null, 2), 'utf8');
    
    res.json({ 
      success: true, 
      message: 'Alert thresholds updated successfully',
      data: currentConfig
    });
  } catch (error) {
    console.error('Error updating alert thresholds:', error);
    res.status(500).json({ success: false, message: 'Error updating alert thresholds', error: error.message });
  }
});

// SPA fallback
app.get('/mikrotik', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'mikrotik.html'));
});

app.get('/capsman', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'capsman.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Mode: ${process.env.USE_REAL_MIKROTIK_API === 'true' ? 'REAL' : 'MOCK'} MikroTik API`);
});