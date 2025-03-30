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
      console.log('Thông số kết nối:', { host: address, port, user: username });
      
      this.client = new RouterOSAPI({
        host: address,
        port: port,
        user: username,
        password: password,
        timeout: 10000, // Tăng timeout lên 10 giây
        keepalive: true
      });

      console.log('Khởi tạo client thành công, đang thực hiện kết nối...');
      await this.client.connect();
      
      this.connected = true;
      this.connectionInfo = { address, port, username, password };
      
      console.log('Kết nối thành công!');
      return true;
    } catch (error) {
      console.error('Lỗi kết nối chi tiết:', error);
      console.error('Thông báo lỗi:', error.message);
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
  
  async getInterfaceStats() {
    this.checkConnection();
    
    try {
      // Lấy thông tin thống kê của tất cả interface
      const interfaces = await this.client.write('/interface/print');
      const stats = await this.client.write('/interface/monitor-traffic', 
        [
          '=interface=' + interfaces.map(i => i.name).join(','),
          '=once='
        ]
      );
      
      // Kết hợp thông tin interface và thống kê
      return stats.map(stat => {
        const iface = interfaces.find(i => i.name === stat.name) || {};
        return {
          name: stat.name || 'Unknown',
          type: iface.type || 'Unknown',
          rxBytes: parseInt(stat['rx-byte'] || 0),
          txBytes: parseInt(stat['tx-byte'] || 0),
          rxPackets: parseInt(stat['rx-packet'] || 0),
          txPackets: parseInt(stat['tx-packet'] || 0),
          macAddress: iface['mac-address'] || '',
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
        };
      });
    } catch (error) {
      console.error('Lỗi khi lấy thống kê interface:', error.message);
      throw new Error('Không thể lấy thống kê interface: ' + error.message);
    }
  }
  
  async getWirelessInfo() {
    this.checkConnection();
    
    try {
      // Lấy danh sách các wireless interface
      const wirelessInterfaces = await this.client.write('/interface/wireless/print');
      
      // Lấy danh sách các station đang kết nối
      let registrationTable = [];
      try {
        registrationTable = await this.client.write('/interface/wireless/registration-table/print');
      } catch (e) {
        console.warn('Không thể lấy bảng đăng ký wireless:', e.message);
      }
      
      // Định dạng kết quả
      return {
        interfaces: wirelessInterfaces.map(w => ({
          name: w.name || 'Unknown',
          ssid: w.ssid || '',
          band: w.band || '',
          frequency: parseInt(w.frequency || 0),
          channelWidth: w['channel-width'] || '',
          radioName: w['radio-name'] || '',
          mode: w.mode || '',
          disabled: w.disabled === 'true',
        })),
        clients: registrationTable.map(c => ({
          interface: c.interface || '',
          macAddress: c['mac-address'] || '',
          signalStrength: parseInt(c['signal-strength'] || 0),
          signalToNoise: parseInt(c['signal-to-noise'] || 0),
          txRate: c['tx-rate'] || '',
          rxRate: c['rx-rate'] || '',
          uptime: c.uptime || '',
        }))
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin wireless:', error.message);
      throw new Error('Không thể lấy thông tin wireless: ' + error.message);
    }
  }
  
  async getDHCPInfo() {
    this.checkConnection();
    
    try {
      // Lấy thông tin DHCP server
      const servers = await this.client.write('/ip/dhcp-server/print');
      
      // Lấy danh sách các lease hiện tại
      const leases = await this.client.write('/ip/dhcp-server/lease/print');
      
      return {
        servers: servers.map(s => ({
          name: s.name || 'Unknown',
          interface: s.interface || '',
          addressPool: s['address-pool'] || '',
          leaseTime: s['lease-time'] || '',
          disabled: s.disabled === 'true',
        })),
        leases: leases.map(l => ({
          address: l.address || '',
          macAddress: l['mac-address'] || '',
          clientId: l['client-id'] || '',
          hostname: l.host || '',
          server: l.server || '',
          status: l.status || '',
          expires: l['expires-after'] || '',
        }))
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin DHCP:', error.message);
      throw new Error('Không thể lấy thông tin DHCP: ' + error.message);
    }
  }
  
  async getFirewallRules() {
    this.checkConnection();
    
    try {
      // Lấy danh sách các filter rule
      const filterRules = await this.client.write('/ip/firewall/filter/print');
      
      // Lấy danh sách các NAT rule
      const natRules = await this.client.write('/ip/firewall/nat/print');
      
      return {
        filterRules: filterRules.map(r => ({
          chain: r.chain || '',
          action: r.action || '',
          protocol: r.protocol || '',
          srcAddress: r['src-address'] || '',
          dstAddress: r['dst-address'] || '',
          disabled: r.disabled === 'true',
          comment: r.comment || '',
        })),
        natRules: natRules.map(r => ({
          chain: r.chain || '',
          action: r.action || '',
          protocol: r.protocol || '',
          srcAddress: r['src-address'] || '',
          dstAddress: r['dst-address'] || '',
          disabled: r.disabled === 'true',
          comment: r.comment || '',
        }))
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin firewall:', error.message);
      throw new Error('Không thể lấy thông tin firewall: ' + error.message);
    }
  }
  
  async getVPNInfo() {
    this.checkConnection();
    
    try {
      // Lấy thông tin PPP interfaces
      const pppInterfaces = await this.client.write('/interface/print', ['?type=ppp-*']);
      
      // Lấy thông tin PPP secrets
      const pppSecrets = await this.client.write('/ppp/secret/print');
      
      // Lấy thông tin active PPP connections
      const activeConnections = await this.client.write('/ppp/active/print');
      
      // Lấy thông tin L2TP server (nếu có)
      let l2tpServer = [];
      try {
        l2tpServer = await this.client.write('/interface/l2tp-server/server/print');
      } catch (e) {
        console.warn('Không thể lấy thông tin L2TP server:', e.message);
      }
      
      return {
        interfaces: pppInterfaces.map(i => ({
          name: i.name || 'Unknown',
          type: i.type || '',
          mtu: parseInt(i.mtu || 0),
          running: i.running === 'true',
          disabled: i.disabled === 'true',
        })),
        secrets: pppSecrets.map(s => ({
          name: s.name || '',
          service: s.service || '',
          profile: s.profile || '',
          disabled: s.disabled === 'true',
        })),
        activeConnections: activeConnections.map(c => ({
          name: c.name || '',
          service: c.service || '',
          address: c.address || '',
          uptime: c.uptime || '',
        })),
        l2tpServer: l2tpServer.map(s => ({
          enabled: s.enabled === 'true',
          authentication: s.authentication || '',
          maxSessions: parseInt(s['max-sessions'] || 0),
        }))
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin VPN:', error.message);
      throw new Error('Không thể lấy thông tin VPN: ' + error.message);
    }
  }
  
  async getLogs(limit = 50) {
    this.checkConnection();
    
    try {
      // Lấy log từ router
      const logs = await this.client.write('/log/print', [`=limit=${limit}`]);
      
      return logs.map(log => ({
        time: log.time || '',
        topics: log.topics || '',
        message: log.message || '',
      }));
    } catch (error) {
      console.error('Lỗi khi lấy log:', error.message);
      throw new Error('Không thể lấy log: ' + error.message);
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