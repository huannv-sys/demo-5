#!/usr/bin/env node

/**
 * MikroTik Data Collector - Thu thập dữ liệu từ thiết bị MikroTik và lưu vào cơ sở dữ liệu
 * 
 * Script này thu thập dữ liệu từ thiết bị MikroTik và lưu vào PostgreSQL database
 * để giám sát theo thời gian. Dữ liệu thu thập bao gồm:
 * - Thông tin tài nguyên hệ thống (CPU, Memory, Uptime)
 * - Thông tin interface và băng thông
 * - Các dịch vụ (DHCP, Firewall, VPN) status
 */

import pg from 'pg';
import { RouterOSAPI } from 'routeros-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Đường dẫn thư mục gốc của dự án
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Đọc biến môi trường từ file .env nếu tồn tại
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Load biến môi trường
loadEnv();

// Cấu hình kết nối database
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
};

// Tạo kết nối đến PostgreSQL
const db = new pg.Pool(dbConfig);

/**
 * Định dạng bytes thành đơn vị dễ đọc
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Chuyển đổi uptime string thành seconds
 */
function uptimeToSeconds(uptimeStr) {
  if (!uptimeStr) return 0;
  
  let totalSeconds = 0;
  
  // Match pattern like "3w1d16h31m11s"
  const weeks = uptimeStr.match(/(\d+)w/);
  const days = uptimeStr.match(/(\d+)d/);
  const hours = uptimeStr.match(/(\d+)h/);
  const minutes = uptimeStr.match(/(\d+)m/);
  const seconds = uptimeStr.match(/(\d+)s/);
  
  if (weeks) totalSeconds += parseInt(weeks[1]) * 7 * 24 * 60 * 60;
  if (days) totalSeconds += parseInt(days[1]) * 24 * 60 * 60;
  if (hours) totalSeconds += parseInt(hours[1]) * 60 * 60;
  if (minutes) totalSeconds += parseInt(minutes[1]) * 60;
  if (seconds) totalSeconds += parseInt(seconds[1]);
  
  return totalSeconds;
}

/**
 * Thu thập dữ liệu từ thiết bị MikroTik
 */
async function collectMikrotikData(connection) {
  console.log(`Đang kết nối đến ${connection.address}:${connection.port} với user ${connection.username}...`);
  
  const api = new RouterOSAPI({
    host: connection.address,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    timeout: 10000
  });
  
  try {
    await api.connect();
    console.log(`✅ Kết nối thành công đến ${connection.name} (${connection.address})!`);
    
    // Dữ liệu thu thập
    const data = {
      routerId: connection.id,
      timestamp: new Date(),
      system: {},
      interfaces: [],
      services: {}
    };
    
    // Thu thập thông tin hệ thống
    try {
      const resources = await api.write('/system/resource/print');
      if (resources && resources.length > 0) {
        const resource = resources[0];
        
        data.system = {
          platform: resource.platform || 'unknown',
          board: resource.board || 'unknown',
          version: resource.version || 'unknown',
          cpuCount: parseInt(resource['cpu-count'] || 1),
          cpuLoad: parseInt(resource['cpu-load'] || 0),
          cpuFrequency: parseInt(resource['cpu-frequency'] || 0),
          totalMemory: parseInt(resource['total-memory'] || 0),
          freeMemory: parseInt(resource['free-memory'] || 0),
          totalHdd: parseInt(resource['total-hdd'] || 0),
          freeHdd: parseInt(resource['free-hdd'] || 0),
          architecture: resource.architecture || 'unknown',
          uptime: resource.uptime || '0s',
          uptimeSeconds: uptimeToSeconds(resource.uptime)
        };
        
        // Tính toán sử dụng bộ nhớ phần trăm
        if (data.system.totalMemory > 0) {
          data.system.memoryUsagePercent = Math.round(
            ((data.system.totalMemory - data.system.freeMemory) / data.system.totalMemory) * 100
          );
        }
        
        // Tính toán sử dụng disk phần trăm
        if (data.system.totalHdd > 0) {
          data.system.hddUsagePercent = Math.round(
            ((data.system.totalHdd - data.system.freeHdd) / data.system.totalHdd) * 100
          );
        }
      }
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin hệ thống:', error.message);
    }
    
    // Thu thập identity
    try {
      const identity = await api.write('/system/identity/print');
      if (identity && identity.length > 0) {
        data.system.identity = identity[0].name;
      }
    } catch (error) {
      console.error('Lỗi khi thu thập identity:', error.message);
    }
    
    // Thu thập thông tin interfaces
    try {
      const interfaces = await api.write('/interface/print');
      
      for (const iface of interfaces) {
        if (iface.type === 'loopback') continue; // Bỏ qua loopback
        
        const interfaceData = {
          name: iface.name,
          type: iface.type || 'unknown',
          macAddress: iface['mac-address'] || '',
          running: iface.running === 'true',
          disabled: iface.disabled === 'true',
          mtu: parseInt(iface.mtu || 0),
          actualMtu: parseInt(iface['actual-mtu'] || 0),
          l2mtu: parseInt(iface['l2mtu'] || 0),
          maxL2mtu: parseInt(iface['max-l2mtu'] || 0),
          bandwidth: {}
        };
        
        // Thu thập stats interface
        try {
          const stats = await api.write('/interface/print', [
            `=.proplist=name,rx-byte,tx-byte,rx-packet,tx-packet,rx-error,tx-error,rx-drop,tx-drop`,
            `?name=${iface.name}`
          ]);
          
          if (stats && stats.length > 0) {
            const stat = stats[0];
            interfaceData.stats = {
              rxBytes: parseInt(stat['rx-byte'] || 0),
              txBytes: parseInt(stat['tx-byte'] || 0),
              rxPackets: parseInt(stat['rx-packet'] || 0),
              txPackets: parseInt(stat['tx-packet'] || 0),
              rxErrors: parseInt(stat['rx-error'] || 0),
              txErrors: parseInt(stat['tx-error'] || 0),
              rxDrops: parseInt(stat['rx-drop'] || 0),
              txDrops: parseInt(stat['tx-drop'] || 0)
            };
          }
        } catch (error) {
          console.error(`Lỗi khi thu thập stats cho ${iface.name}:`, error.message);
        }
        
        // Thu thập bandwidth hiện tại
        if (iface.running === 'true') {
          try {
            const traffic = await api.write('/interface/monitor-traffic', [
              `=interface=${iface.name}`,
              '=once='
            ]);
            
            if (traffic && traffic.length > 0) {
              const sample = traffic[0];
              interfaceData.bandwidth = {
                rxBitsPerSecond: parseInt(sample['rx-bits-per-second'] || 0),
                txBitsPerSecond: parseInt(sample['tx-bits-per-second'] || 0)
              };
            }
          } catch (error) {
            console.error(`Lỗi khi thu thập bandwidth cho ${iface.name}:`, error.message);
          }
        }
        
        data.interfaces.push(interfaceData);
      }
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin interfaces:', error.message);
    }
    
    // Thu thập thông tin DHCP
    try {
      const dhcpServer = await api.write('/ip/dhcp-server/print');
      const dhcpLeases = await api.write('/ip/dhcp-server/lease/print');
      
      data.services.dhcp = {
        serverCount: dhcpServer.length,
        activeServers: dhcpServer.filter(server => server.disabled === 'false').length,
        leaseCount: dhcpLeases.length,
        activeLeases: dhcpLeases.filter(lease => lease.status === 'bound').length
      };
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin DHCP:', error.message);
    }
    
    // Thu thập thông tin Firewall
    try {
      const filterRules = await api.write('/ip/firewall/filter/print');
      const natRules = await api.write('/ip/firewall/nat/print');
      
      data.services.firewall = {
        filterRules: filterRules.length,
        activeFilterRules: filterRules.filter(rule => rule.disabled === 'false').length,
        natRules: natRules.length,
        activeNatRules: natRules.filter(rule => rule.disabled === 'false').length
      };
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin Firewall:', error.message);
    }
    
    // Thu thập thông tin Routing
    try {
      const routes = await api.write('/ip/route/print');
      
      data.services.routing = {
        routeCount: routes.length,
        activeRoutes: routes.filter(route => route.active === 'true').length,
        staticRoutes: routes.filter(route => route.static === 'true').length,
        dynamicRoutes: routes.filter(route => route.dynamic === 'true').length
      };
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin Routing:', error.message);
    }
    
    // Thu thập thông tin VPN
    try {
      let vpnStatus = {
        pptp: { enabled: false, active: 0 },
        l2tp: { enabled: false, active: 0 },
        sstp: { enabled: false, active: 0 },
        openvpn: { enabled: false, active: 0 },
        ipsec: { peers: 0, policies: 0 }
      };
      
      // PPTP Server
      try {
        const pptpServer = await api.write('/interface/pptp-server/server/print');
        if (pptpServer && pptpServer.length > 0) {
          vpnStatus.pptp.enabled = pptpServer[0].disabled === 'false';
        }
        
        const pptpActive = await api.write('/interface/pptp-server/active/print');
        vpnStatus.pptp.active = pptpActive.length;
      } catch (error) {
        // PPTP có thể không được cấu hình
      }
      
      // L2TP Server
      try {
        const l2tpServer = await api.write('/interface/l2tp-server/server/print');
        if (l2tpServer && l2tpServer.length > 0) {
          vpnStatus.l2tp.enabled = l2tpServer[0].disabled === 'false';
        }
        
        const l2tpActive = await api.write('/interface/l2tp-server/active/print');
        vpnStatus.l2tp.active = l2tpActive.length;
      } catch (error) {
        // L2TP có thể không được cấu hình
      }
      
      // SSTP Server
      try {
        const sstpServer = await api.write('/interface/sstp-server/server/print');
        if (sstpServer && sstpServer.length > 0) {
          vpnStatus.sstp.enabled = sstpServer[0].disabled === 'false';
        }
        
        const sstpActive = await api.write('/interface/sstp-server/active/print');
        vpnStatus.sstp.active = sstpActive.length;
      } catch (error) {
        // SSTP có thể không được cấu hình
      }
      
      // OpenVPN Server
      try {
        const ovpnServer = await api.write('/interface/ovpn-server/server/print');
        if (ovpnServer && ovpnServer.length > 0) {
          vpnStatus.openvpn.enabled = ovpnServer[0].disabled === 'false';
        }
      } catch (error) {
        // OpenVPN có thể không được cấu hình
      }
      
      // IPsec
      try {
        const ipsecPeers = await api.write('/ip/ipsec/peer/print');
        vpnStatus.ipsec.peers = ipsecPeers.length;
        
        const ipsecPolicies = await api.write('/ip/ipsec/policy/print');
        vpnStatus.ipsec.policies = ipsecPolicies.length;
      } catch (error) {
        // IPsec có thể không được cấu hình
      }
      
      data.services.vpn = vpnStatus;
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin VPN:', error.message);
    }
    
    // Thu thập thông tin Wireless
    try {
      const wirelessIfaces = await api.write('/interface/wireless/print');
      
      data.services.wireless = {
        interfaceCount: wirelessIfaces.length,
        activeInterfaces: wirelessIfaces.filter(wiface => wiface.disabled === 'false').length
      };
      
      if (wirelessIfaces.length > 0) {
        try {
          const wirelessClients = await api.write('/interface/wireless/registration-table/print');
          data.services.wireless.clientCount = wirelessClients.length;
        } catch (error) {
          data.services.wireless.clientCount = 0;
        }
      } else {
        data.services.wireless.clientCount = 0;
      }
    } catch (error) {
      console.error('Lỗi khi thu thập thông tin Wireless:', error.message);
    }
    
    await api.close();
    console.log(`✅ Thu thập dữ liệu thành công từ ${connection.name}`);
    
    return data;
    
  } catch (error) {
    console.error(`❌ Lỗi kết nối đến ${connection.name} (${connection.address}):`, error.message);
    return null;
  }
}

/**
 * Lưu dữ liệu vào cơ sở dữ liệu
 */
async function saveDataToDatabase(data) {
  if (!data) return false;
  
  try {
    const client = await db.connect();
    
    try {
      // Bắt đầu transaction
      await client.query('BEGIN');
      
      // Lưu thông tin hệ thống
      const systemRes = await client.query(
        `INSERT INTO system_metrics
        (router_id, timestamp, cpu_load, memory_usage, disk_usage, uptime_seconds, version, platform)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          data.routerId,
          data.timestamp,
          data.system.cpuLoad || 0,
          data.system.memoryUsagePercent || 0,
          data.system.hddUsagePercent || 0,
          data.system.uptimeSeconds || 0,
          data.system.version || 'unknown',
          data.system.platform || 'unknown'
        ]
      );
      
      const systemMetricId = systemRes.rows[0].id;
      
      // Lưu thông tin interfaces
      for (const iface of data.interfaces) {
        await client.query(
          `INSERT INTO interface_metrics
          (router_id, system_metric_id, timestamp, interface_name, type, rx_bytes, tx_bytes,
           rx_bits_per_second, tx_bits_per_second, status, mtu)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            data.routerId,
            systemMetricId,
            data.timestamp,
            iface.name,
            iface.type || 'unknown',
            iface.stats?.rxBytes || 0,
            iface.stats?.txBytes || 0,
            iface.bandwidth?.rxBitsPerSecond || 0,
            iface.bandwidth?.txBitsPerSecond || 0,
            iface.running ? 'active' : 'inactive',
            iface.mtu || 0
          ]
        );
      }
      
      // Lưu thông tin dịch vụ
      if (data.services) {
        await client.query(
          `INSERT INTO service_metrics
          (router_id, system_metric_id, timestamp, dhcp_active_leases, firewall_active_rules,
           vpn_active_connections, wireless_active_clients, active_routes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            data.routerId,
            systemMetricId,
            data.timestamp,
            data.services.dhcp?.activeLeases || 0,
            (data.services.firewall?.activeFilterRules || 0) + (data.services.firewall?.activeNatRules || 0),
            (data.services.vpn?.pptp?.active || 0) + (data.services.vpn?.l2tp?.active || 0) + 
            (data.services.vpn?.sstp?.active || 0),
            data.services.wireless?.clientCount || 0,
            data.services.routing?.activeRoutes || 0
          ]
        );
      }
      
      // Commit transaction
      await client.query('COMMIT');
      console.log(`✅ Lưu dữ liệu thành công cho router ID ${data.routerId}`);
      return true;
      
    } catch (err) {
      // Rollback nếu có lỗi
      await client.query('ROLLBACK');
      console.error('❌ Lỗi khi lưu dữ liệu:', err.message);
      return false;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('❌ Lỗi kết nối database:', err.message);
    return false;
  }
}

/**
 * Lấy danh sách thiết bị MikroTik từ database
 */
async function getRouterConnections() {
  try {
    const result = await db.query('SELECT id, name, address, port, username, password FROM router_connections');
    return result.rows;
  } catch (error) {
    console.error('❌ Lỗi khi lấy danh sách thiết bị:', error.message);
    return [];
  }
}

/**
 * Kiểm tra và tạo các bảng cần thiết nếu chưa tồn tại
 */
async function ensureTablesExist() {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // Bảng system_metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id SERIAL PRIMARY KEY,
        router_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        cpu_load INTEGER NOT NULL,
        memory_usage INTEGER NOT NULL,
        disk_usage INTEGER NOT NULL,
        uptime_seconds BIGINT NOT NULL,
        version VARCHAR(50) NOT NULL,
        platform VARCHAR(50) NOT NULL
      )
    `);
    
    // Bảng interface_metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS interface_metrics (
        id SERIAL PRIMARY KEY,
        router_id INTEGER NOT NULL,
        system_metric_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        interface_name VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL,
        rx_bytes BIGINT NOT NULL,
        tx_bytes BIGINT NOT NULL,
        rx_bits_per_second INTEGER NOT NULL,
        tx_bits_per_second INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL,
        mtu INTEGER NOT NULL,
        FOREIGN KEY (system_metric_id) REFERENCES system_metrics(id) ON DELETE CASCADE
      )
    `);
    
    // Bảng service_metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_metrics (
        id SERIAL PRIMARY KEY,
        router_id INTEGER NOT NULL,
        system_metric_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        dhcp_active_leases INTEGER NOT NULL,
        firewall_active_rules INTEGER NOT NULL,
        vpn_active_connections INTEGER NOT NULL,
        wireless_active_clients INTEGER NOT NULL,
        active_routes INTEGER NOT NULL,
        FOREIGN KEY (system_metric_id) REFERENCES system_metrics(id) ON DELETE CASCADE
      )
    `);
    
    // Tạo indices để tăng tốc truy vấn
    await client.query('CREATE INDEX IF NOT EXISTS idx_system_metrics_router_id ON system_metrics(router_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_interface_metrics_router_id ON interface_metrics(router_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_interface_metrics_interface_name ON interface_metrics(interface_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_service_metrics_router_id ON service_metrics(router_id)');
    
    await client.query('COMMIT');
    console.log('✅ Đã kiểm tra và tạo các bảng cần thiết');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi tạo bảng:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Xóa dữ liệu cũ (giữ lại 30 ngày)
 */
async function cleanupOldData() {
  try {
    const result = await db.query(
      `DELETE FROM system_metrics WHERE timestamp < NOW() - INTERVAL '30 days'`
    );
    console.log(`✅ Đã xóa ${result.rowCount} bản ghi cũ`);
  } catch (error) {
    console.error('❌ Lỗi khi xóa dữ liệu cũ:', error.message);
  }
}

/**
 * Hàm chính - thu thập dữ liệu từ tất cả các thiết bị
 */
async function collectDataFromAllRouters() {
  try {
    // Đảm bảo các bảng tồn tại
    await ensureTablesExist();
    
    // Xóa dữ liệu cũ
    await cleanupOldData();
    
    // Lấy danh sách thiết bị
    const connections = await getRouterConnections();
    
    if (connections.length === 0) {
      console.log('Không có thiết bị MikroTik nào được cấu hình.');
      return;
    }
    
    console.log(`Tìm thấy ${connections.length} thiết bị MikroTik.`);
    
    // Thu thập dữ liệu từ từng thiết bị
    for (const connection of connections) {
      console.log(`\nĐang thu thập dữ liệu từ ${connection.name} (${connection.address})...`);
      const data = await collectMikrotikData(connection);
      
      if (data) {
        await saveDataToDatabase(data);
      }
    }
    
    console.log('\n✅ Hoàn thành quá trình thu thập dữ liệu');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    // Đóng kết nối database
    await db.end();
  }
}

// Thực thi thu thập dữ liệu
collectDataFromAllRouters();