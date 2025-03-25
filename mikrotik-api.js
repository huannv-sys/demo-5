// Định nghĩa lớp API MikroTik
const { RouterOSAPI } = require('routeros-client');

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

// Tạo và export instance
const api = new MikroTikAPI();
module.exports = api;