#!/usr/bin/env node

/**
 * Script nâng cao để kiểm tra đầy đủ thông tin giám sát MikroTik
 * Sử dụng: node check-monitoring-info.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]
 */

import { RouterOSAPI } from 'routeros-client';

// Lấy tham số từ dòng lệnh
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Thiếu tham số. Sử dụng: node check-monitoring-info.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]');
  process.exit(1);
}

const host = args[0];
const username = args[1];
const password = args[2];
const port = args[3] ? parseInt(args[3]) : 8728;

/**
 * In tiêu đề phần
 */
function printSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${title.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Định dạng bytes thành đơn vị đọc được (KB, MB, GB, etc)
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
 * Định dạng tốc độ trong bit/s
 */
function formatBitrate(bits, decimals = 2) {
  if (bits === 0) return '0 bps';
  
  const k = 1000; // Sử dụng 1000 cho bit/s, không phải 1024
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  
  const i = Math.floor(Math.log(bits) / Math.log(k));
  
  return parseFloat((bits / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Hàm chính để kiểm tra MikroTik
 */
async function checkMonitoringInfo() {
  console.log('Đang kiểm tra thông tin giám sát thiết bị MikroTik...');
  
  try {
    console.log(`Kết nối đến ${host}:${port} với user ${username}...`);
    
    const api = new RouterOSAPI({
      host,
      port,
      user: username,
      password,
      timeout: 5000,
    });

    await api.connect();
    console.log('✅ Kết nối thành công!');
    
    // Lấy thông tin hệ thống
    printSection('Thông tin hệ thống');
    const resources = await api.write('/system/resource/print');
    const resource = resources[0];
    
    console.log(`Platform      : ${resource.platform || 'N/A'}`);
    console.log(`Board         : ${resource.board || 'N/A'}`);
    console.log(`Version       : ${resource.version || 'N/A'}`);
    console.log(`Architecture  : ${resource.architecture || 'N/A'}`);
    console.log(`CPU           : ${resource['cpu'] || 'N/A'}`);
    console.log(`CPU Cores     : ${resource['cpu-count'] || 'N/A'}`);
    console.log(`CPU Load      : ${resource['cpu-load']}%`);
    console.log(`Uptime        : ${resource.uptime || 'N/A'}`);
    
    const totalMemory = parseInt(resource['total-memory'] || 0);
    const freeMemory = parseInt(resource['free-memory'] || 0);
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
    
    console.log(`Memory Usage  : ${memoryUsagePercent}% (${formatBytes(usedMemory)} of ${formatBytes(totalMemory)})`);
    
    const totalHdd = parseInt(resource['total-hdd-space'] || 0);
    const freeHdd = parseInt(resource['free-hdd-space'] || 0);
    const usedHdd = totalHdd - freeHdd;
    const hddUsagePercent = Math.round((usedHdd / totalHdd) * 100);
    
    if (totalHdd > 0) {
      console.log(`Storage Usage : ${hddUsagePercent}% (${formatBytes(usedHdd)} of ${formatBytes(totalHdd)})`);
    }
    
    // Thông tin Identity
    printSection('Thông tin Identity');
    try {
      const identity = await api.write('/system/identity/print');
      console.log(`Tên thiết bị : ${identity[0].name || 'N/A'}`);
    } catch (error) {
      console.log(`Tên thiết bị : Không thể lấy thông tin (${error.message})`);
    }
    
    // Thông tin giao diện mạng
    printSection('Giao diện mạng');
    const interfaces = await api.write('/interface/print');
    
    interfaces.forEach(iface => {
      const status = iface.running === 'true' ? '🟢' : '🔴';
      const disabled = iface.disabled === 'true' ? ' (Disabled)' : '';
      console.log(`${status} ${iface.name} - ${iface.type || 'N/A'}${disabled}`);
      if (iface['mac-address']) {
        console.log(`   MAC: ${iface['mac-address']}`);
      }
      if (iface.mtu) {
        console.log(`   MTU: ${iface.mtu}`);
      }
      if (iface.comment) {
        console.log(`   Ghi chú: ${iface.comment}`);
      }
    });
    
    // Thông tin IP
    printSection('Địa chỉ IP');
    try {
      const addresses = await api.write('/ip/address/print');
      if (addresses.length === 0) {
        console.log('Không có địa chỉ IP nào.');
      } else {
        addresses.forEach(address => {
          const disabled = address.disabled === 'true' ? ' (Disabled)' : '';
          console.log(`Interface: ${address.interface}${disabled}`);
          console.log(`   Địa chỉ: ${address.address}`);
          if (address.network) {
            console.log(`   Mạng: ${address.network}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin địa chỉ IP: ' + error.message);
    }
    
    // Theo dõi tài nguyên
    printSection('Theo dõi tài nguyên');
    // Lấy thông tin về CPU trong vài giây
    console.log('Đang thu thập thông tin CPU trong 5 giây...');
    
    try {
      // Thực hiện lệnh '/system/resource/monitor' để lấy dữ liệu real-time
      const startTime = Date.now();
      const cpuSamples = [];
      
      for (let i = 0; i < 5; i++) {
        const monitor = await api.write('/system/resource/monitor', [
          '=.proplist=cpu-load,free-memory,free-hdd-space',
          '=once='
        ]);
        
        if (monitor && monitor[0]) {
          cpuSamples.push({
            time: Date.now() - startTime,
            cpuLoad: parseInt(monitor[0]['cpu-load'] || 0),
            freeMemory: parseInt(monitor[0]['free-memory'] || 0),
            freeHdd: parseInt(monitor[0]['free-hdd-space'] || 0)
          });
        }
        
        // Đợi 1 giây
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Hiển thị mẫu CPU
      console.log('CPU Usage (%):');
      cpuSamples.forEach(sample => {
        const barLength = Math.round(sample.cpuLoad / 2);
        const bar = '█'.repeat(barLength) + '░'.repeat(50 - barLength);
        console.log(`[${(sample.time / 1000).toFixed(1)}s] ${sample.cpuLoad}% ${bar}`);
      });
      
      // Tính CPU trung bình
      const avgCpu = cpuSamples.reduce((sum, sample) => sum + sample.cpuLoad, 0) / cpuSamples.length;
      console.log(`\nCPU trung bình: ${avgCpu.toFixed(1)}%`);
      
    } catch (error) {
      console.log('Không thể lấy thông tin giám sát tài nguyên: ' + error.message);
    }
    
    // Thông tin về băng thông
    printSection('Băng thông mạng');
    try {
      console.log('Đang thu thập thông tin băng thông trong 3 giây...');
      
      // Lấy danh sách tất cả các interface
      const ifaces = await api.write('/interface/print');
      const activeIfaces = ifaces
        .filter(iface => iface.running === 'true' && iface.type !== 'loopback')
        .slice(0, 3); // Giới hạn 3 interface để không quá dài
      
      if (activeIfaces.length === 0) {
        console.log('Không có interface nào đang hoạt động.');
        return;
      }
      
      // Lấy thông tin traffic ban đầu
      for (const iface of activeIfaces) {
        const initialTraffic = await api.write('/interface/monitor-traffic', [
          `=interface=${iface.name}`,
          '=once='
        ]);
        
        const firstSample = initialTraffic[0] || {};
        iface.firstRxBits = parseInt(firstSample['rx-bits-per-second'] || 0);
        iface.firstTxBits = parseInt(firstSample['tx-bits-per-second'] || 0);
        
        // Lấy thống kê từ interface
        const stats = await api.write('/interface/print', [
          `=.proplist=name,rx-byte,tx-byte,rx-packet,tx-packet,rx-error,tx-error,rx-drop,tx-drop`,
          `?name=${iface.name}`
        ]);
        
        if (stats.length > 0) {
          iface.stats = stats[0];
        }
      }
      
      // Đợi 3 giây
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Lấy thông tin traffic sau 3 giây
      for (const iface of activeIfaces) {
        const currentTraffic = await api.write('/interface/monitor-traffic', [
          `=interface=${iface.name}`,
          '=once='
        ]);
        
        const secondSample = currentTraffic[0] || {};
        iface.secondRxBits = parseInt(secondSample['rx-bits-per-second'] || 0);
        iface.secondTxBits = parseInt(secondSample['tx-bits-per-second'] || 0);
        
        console.log(`Interface: ${iface.name} (${iface.type})`);
        console.log(`   Download: ${formatBitrate(iface.secondRxBits)}`);
        console.log(`   Upload:   ${formatBitrate(iface.secondTxBits)}`);
        
        if (iface.stats) {
          console.log(`   Total RX: ${formatBytes(parseInt(iface.stats['rx-byte'] || 0))}`);
          console.log(`   Total TX: ${formatBytes(parseInt(iface.stats['tx-byte'] || 0))}`);
          console.log(`   Packets RX/TX: ${iface.stats['rx-packet'] || 0} / ${iface.stats['tx-packet'] || 0}`);
          console.log(`   Errors RX/TX: ${iface.stats['rx-error'] || 0} / ${iface.stats['tx-error'] || 0}`);
          console.log(`   Drops RX/TX: ${iface.stats['rx-drop'] || 0} / ${iface.stats['tx-drop'] || 0}`);
        }
        
        console.log('');
      }
      
    } catch (error) {
      console.log('Không thể lấy thông tin băng thông: ' + error.message);
    }
    
    // Thông tin DHCP Server và Leases
    printSection('DHCP Server và Clients');
    try {
      // Lấy thông tin DHCP Server
      const dhcpServers = await api.write('/ip/dhcp-server/print');
      if (dhcpServers.length === 0) {
        console.log('Không có DHCP Server nào được cấu hình.');
      } else {
        console.log('DHCP Servers:');
        dhcpServers.forEach(server => {
          const enabled = server.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} ${server.name} (Interface: ${server.interface})`);
          if (server['address-pool']) {
            console.log(`   Pool: ${server['address-pool']}`);
          }
          if (server.lease-time) {
            console.log(`   Lease time: ${server['lease-time']}`);
          }
        });
        console.log('');
      }
      
      // Lấy thông tin DHCP Pools
      console.log('DHCP Pools:');
      const dhcpPools = await api.write('/ip/pool/print');
      if (dhcpPools.length === 0) {
        console.log('Không có DHCP Pool nào được cấu hình.');
      } else {
        dhcpPools.forEach(pool => {
          console.log(`- ${pool.name}: ${pool.ranges}`);
        });
        console.log('');
      }
      
      // Lấy thông tin DHCP Leases
      console.log('DHCP Clients:');
      const dhcpLeases = await api.write('/ip/dhcp-server/lease/print');
      if (dhcpLeases.length === 0) {
        console.log('Không có client DHCP nào.');
      } else {
        dhcpLeases.forEach(lease => {
          const active = lease['status'] === 'bound' ? '🟢' : '🔴';
          console.log(`${active} ${lease['host-name'] || 'Không tên'} - ${lease.address} (MAC: ${lease['mac-address']})`);
          if (lease['last-seen']) {
            console.log(`   Last seen: ${lease['last-seen']}`);
          }
          if (lease.server) {
            console.log(`   Server: ${lease.server}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin DHCP: ' + error.message);
    }
    
    // Thông tin Firewall/NAT
    printSection('Firewall và NAT Rules');
    try {
      // Lấy thông tin Firewall Filter Rules
      const filterRules = await api.write('/ip/firewall/filter/print');
      console.log(`Firewall Filter Rules: ${filterRules.length}`);
      if (filterRules.length > 0) {
        console.log('Top 5 Filter Rules:');
        filterRules.slice(0, 5).forEach((rule, index) => {
          const enabled = rule.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} [${index + 1}] Chain: ${rule.chain}, Action: ${rule.action}`);
          if (rule.comment) {
            console.log(`   Comment: ${rule.comment}`);
          }
          console.log(`   ${rule['src-address'] ? 'Src: ' + rule['src-address'] : ''} ${rule['dst-address'] ? 'Dst: ' + rule['dst-address'] : ''}`);
          if (rule.protocol) {
            console.log(`   Protocol: ${rule.protocol}`);
          }
        });
        console.log('');
      }
      
      // Lấy thông tin NAT Rules
      const natRules = await api.write('/ip/firewall/nat/print');
      console.log(`NAT Rules: ${natRules.length}`);
      if (natRules.length > 0) {
        console.log('Top 5 NAT Rules:');
        natRules.slice(0, 5).forEach((rule, index) => {
          const enabled = rule.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} [${index + 1}] Chain: ${rule.chain}, Action: ${rule.action}`);
          if (rule.comment) {
            console.log(`   Comment: ${rule.comment}`);
          }
          console.log(`   ${rule['src-address'] ? 'Src: ' + rule['src-address'] : ''} ${rule['dst-address'] ? 'Dst: ' + rule['dst-address'] : ''}`);
          if (rule['to-addresses']) {
            console.log(`   To-Addresses: ${rule['to-addresses']}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin Firewall/NAT: ' + error.message);
    }
    
    // Thông tin Routing
    printSection('Bảng định tuyến');
    try {
      // Lấy bảng định tuyến
      const routes = await api.write('/ip/route/print');
      console.log(`Số lượng route: ${routes.length}`);
      
      if (routes.length > 0) {
        console.log('Routes:');
        routes.forEach(route => {
          const active = route.active === 'true' ? '🟢' : '🔴';
          console.log(`${active} ${route.dst-address || '0.0.0.0/0'} via ${route.gateway || ''} (${route.distance || ''})`);
        });
        console.log('');
      }
      
      // Kiểm tra BGP
      try {
        const bgpInstances = await api.write('/routing/bgp/instance/print');
        if (bgpInstances.length > 0) {
          console.log('BGP Instances:');
          bgpInstances.forEach(bgp => {
            console.log(`- AS: ${bgp['as']}, Router ID: ${bgp['router-id']}`);
          });
          
          // BGP Peers
          const bgpPeers = await api.write('/routing/bgp/peer/print');
          if (bgpPeers.length > 0) {
            console.log('BGP Peers:');
            bgpPeers.forEach(peer => {
              const state = peer.state || 'unknown';
              const stateIcon = state.includes('established') ? '🟢' : '🔴';
              console.log(`${stateIcon} ${peer.name}: ${peer['remote-address']} (Remote AS: ${peer['remote-as']})`);
              console.log(`   State: ${state}`);
            });
          }
        }
      } catch (error) {
        // BGP có thể không được cấu hình
      }
      
      // Kiểm tra OSPF
      try {
        const ospfInstances = await api.write('/routing/ospf/instance/print');
        if (ospfInstances.length > 0) {
          console.log('OSPF Instances:');
          ospfInstances.forEach(ospf => {
            console.log(`- ${ospf.name}, Router ID: ${ospf['router-id']}`);
          });
          
          // OSPF Neighbors
          const ospfNeighbors = await api.write('/routing/ospf/neighbor/print');
          if (ospfNeighbors.length > 0) {
            console.log('OSPF Neighbors:');
            ospfNeighbors.forEach(neighbor => {
              const stateIcon = neighbor.state === 'Full' ? '🟢' : '🔴';
              console.log(`${stateIcon} ${neighbor.address} (State: ${neighbor.state})`);
              console.log(`   Interface: ${neighbor.interface}`);
            });
          }
        }
      } catch (error) {
        // OSPF có thể không được cấu hình
      }
    } catch (error) {
      console.log('Không thể lấy thông tin định tuyến: ' + error.message);
    }
    
    // Thông tin Wireless
    printSection('Wireless Networks');
    try {
      // Kiểm tra interfaces wireless
      const wirelessIfaces = await api.write('/interface/wireless/print');
      if (wirelessIfaces.length === 0) {
        console.log('Không có interface wireless nào.');
      } else {
        console.log('Wireless Interfaces:');
        wirelessIfaces.forEach(wiface => {
          const enabled = wiface.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} ${wiface.name} (${wiface['mode'] || 'unknown mode'})`);
          console.log(`   SSID: ${wiface.ssid || 'N/A'}, Frequency: ${wiface.frequency || 'N/A'}`);
          console.log(`   Band: ${wiface.band || 'N/A'}, Channel Width: ${wiface['channel-width'] || 'N/A'}`);
        });
        
        // Lấy danh sách các client kết nối
        try {
          const wirelessClients = await api.write('/interface/wireless/registration-table/print');
          if (wirelessClients.length > 0) {
            console.log('\nWireless Clients:');
            wirelessClients.forEach(client => {
              console.log(`- MAC: ${client['mac-address']}, Interface: ${client.interface}`);
              console.log(`   Signal: ${client['signal-strength']} dBm, TX/RX Rate: ${client['tx-rate']}/${client['rx-rate']} Mbps`);
            });
          } else {
            console.log('\nKhông có client wireless nào kết nối.');
          }
        } catch (error) {
          console.log('Không thể lấy thông tin client wireless: ' + error.message);
        }
      }
    } catch (error) {
      console.log('Không thể lấy thông tin wireless: ' + error.message);
    }
    
    // Thông tin VPN
    printSection('VPN');
    try {
      // PPTP Server
      try {
        const pptpServer = await api.write('/interface/pptp-server/server/print');
        if (pptpServer.length > 0) {
          const enabled = pptpServer[0].disabled === 'false' ? '🟢' : '🔴';
          console.log(`PPTP Server: ${enabled} (Max-MTU: ${pptpServer[0]['mtu'] || 'default'})`);
        }
        
        const pptpActive = await api.write('/interface/pptp-server/active/print');
        console.log(`PPTP Active Connections: ${pptpActive.length}`);
        if (pptpActive.length > 0) {
          pptpActive.forEach(conn => {
            console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          });
        }
      } catch (error) {
        // PPTP Server có thể không được cấu hình
      }
      
      // L2TP Server
      try {
        const l2tpServer = await api.write('/interface/l2tp-server/server/print');
        if (l2tpServer.length > 0) {
          const enabled = l2tpServer[0].disabled === 'false' ? '🟢' : '🔴';
          console.log(`L2TP Server: ${enabled} (Max-MTU: ${l2tpServer[0]['mtu'] || 'default'})`);
        }
        
        const l2tpActive = await api.write('/interface/l2tp-server/active/print');
        console.log(`L2TP Active Connections: ${l2tpActive.length}`);
        if (l2tpActive.length > 0) {
          l2tpActive.forEach(conn => {
            console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          });
        }
      } catch (error) {
        // L2TP Server có thể không được cấu hình
      }
      
      // SSTP Server
      try {
        const sstpServer = await api.write('/interface/sstp-server/server/print');
        if (sstpServer.length > 0) {
          const enabled = sstpServer[0].disabled === 'false' ? '🟢' : '🔴';
          console.log(`SSTP Server: ${enabled}`);
        }
        
        const sstpActive = await api.write('/interface/sstp-server/active/print');
        console.log(`SSTP Active Connections: ${sstpActive.length}`);
        if (sstpActive.length > 0) {
          sstpActive.forEach(conn => {
            console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          });
        }
      } catch (error) {
        // SSTP Server có thể không được cấu hình
      }
      
      // IPSec
      try {
        const ipsecPeers = await api.write('/ip/ipsec/peer/print');
        console.log(`IPSec Peers: ${ipsecPeers.length}`);
        if (ipsecPeers.length > 0) {
          ipsecPeers.forEach(peer => {
            console.log(`- ${peer.address || '0.0.0.0'} (${peer.disabled === 'false' ? 'Enabled' : 'Disabled'})`);
          });
        }
      } catch (error) {
        // IPSec có thể không được cấu hình
      }
    } catch (error) {
      console.log('Không thể lấy thông tin VPN: ' + error.message);
    }
    
    // Thông tin người dùng
    printSection('Người dùng hệ thống');
    try {
      const users = await api.write('/user/print');
      console.log(`Số lượng người dùng: ${users.length}`);
      
      if (users.length > 0) {
        console.log('Users:');
        users.forEach(user => {
          const enabled = user.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} ${user.name} (Group: ${user.group})`);
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin người dùng: ' + error.message);
    }
    
    // Thông tin Logs
    printSection('System Logs');
    try {
      const logs = await api.write('/log/print', ['=count=5']);
      if (logs.length === 0) {
        console.log('Không có log nào.');
      } else {
        logs.forEach(log => {
          console.log(`[${log.time}] ${log.topics}: ${log.message}`);
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin logs: ' + error.message);
    }
    
    await api.close();
    console.log('\n✅ Kiểm tra hoàn tất. Đã ngắt kết nối.');
    
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

// Thực thi kiểm tra
checkMonitoringInfo();