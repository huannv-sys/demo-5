#!/usr/bin/env node

/**
 * Script để kiểm tra thông tin Wireless và VPN từ thiết bị MikroTik
 * Sử dụng: node test-wireless-vpn.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]
 */

import { RouterOSAPI } from 'routeros-client';

// Lấy tham số từ dòng lệnh
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Thiếu tham số. Sử dụng: node test-wireless-vpn.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]');
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
 * Hàm chính để kiểm tra thông tin wireless và VPN
 */
async function testWirelessVPN() {
  console.log('Đang kết nối đến thiết bị MikroTik...');
  
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
    
    // Lấy thông tin Wireless
    printSection('Wireless');
    try {
      // Kiểm tra interfaces wireless
      const wirelessIfaces = await api.write('/interface/wireless/print');
      if (wirelessIfaces.length === 0) {
        console.log('Không có interface wireless nào.');
      } else {
        console.log(`Số lượng Wireless Interfaces: ${wirelessIfaces.length}`);
        wirelessIfaces.forEach(wiface => {
          const enabled = wiface.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${enabled} ${wiface.name} (${wiface.mode || 'unknown mode'})`);
          console.log(`  SSID: ${wiface.ssid || 'N/A'}`);
          console.log(`  Frequency: ${wiface.frequency || 'N/A'}, Band: ${wiface.band || 'N/A'}`);
          if (wiface['channel-width']) {
            console.log(`  Channel Width: ${wiface['channel-width']}`);
          }
        });
        
        // Lấy danh sách các client kết nối
        try {
          const wirelessClients = await api.write('/interface/wireless/registration-table/print');
          console.log(`\nSố lượng Wireless Clients: ${wirelessClients.length}`);
          if (wirelessClients.length > 0) {
            wirelessClients.forEach(client => {
              console.log(`- MAC: ${client['mac-address']}, Interface: ${client.interface}`);
              console.log(`  Signal: ${client['signal-strength'] || 'N/A'} dBm, Uptime: ${client.uptime || 'N/A'}`);
              console.log(`  TX/RX Rate: ${client['tx-rate'] || 'N/A'}/${client['rx-rate'] || 'N/A'} Mbps`);
            });
          }
        } catch (error) {
          console.log('Không thể lấy thông tin client wireless: ' + error.message);
        }
      }
    } catch (error) {
      console.log('Không thể lấy thông tin wireless: ' + error.message);
    }
    
    // Lấy thông tin VPN
    printSection('VPN Services');
    
    // PPTP Server
    try {
      const pptpServer = await api.write('/interface/pptp-server/server/print');
      if (pptpServer.length > 0) {
        const status = pptpServer[0].disabled === 'false' ? '🟢' : '🔴';
        console.log(`PPTP Server: ${status}`);
        console.log(`  Enabled: ${pptpServer[0].disabled === 'false' ? 'Yes' : 'No'}`);
        if (pptpServer[0].mtu) {
          console.log(`  MTU: ${pptpServer[0].mtu}`);
        }
      } else {
        console.log('PPTP Server không được cấu hình.');
      }
      
      // Kết nối PPTP active
      const pptpActive = await api.write('/interface/pptp-server/active/print');
      console.log(`\nPPTP Active Connections: ${pptpActive.length}`);
      if (pptpActive.length > 0) {
        pptpActive.forEach(conn => {
          console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          if (conn.uptime) {
            console.log(`  Uptime: ${conn.uptime}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin PPTP Server: ' + error.message);
    }
    
    // L2TP Server
    try {
      const l2tpServer = await api.write('/interface/l2tp-server/server/print');
      if (l2tpServer.length > 0) {
        const status = l2tpServer[0].disabled === 'false' ? '🟢' : '🔴';
        console.log(`\nL2TP Server: ${status}`);
        console.log(`  Enabled: ${l2tpServer[0].disabled === 'false' ? 'Yes' : 'No'}`);
        if (l2tpServer[0].mtu) {
          console.log(`  MTU: ${l2tpServer[0].mtu}`);
        }
      } else {
        console.log('\nL2TP Server không được cấu hình.');
      }
      
      // Kết nối L2TP active
      const l2tpActive = await api.write('/interface/l2tp-server/active/print');
      console.log(`L2TP Active Connections: ${l2tpActive.length}`);
      if (l2tpActive.length > 0) {
        l2tpActive.forEach(conn => {
          console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          if (conn.uptime) {
            console.log(`  Uptime: ${conn.uptime}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin L2TP Server: ' + error.message);
    }
    
    // SSTP Server
    try {
      const sstpServer = await api.write('/interface/sstp-server/server/print');
      if (sstpServer.length > 0) {
        const status = sstpServer[0].disabled === 'false' ? '🟢' : '🔴';
        console.log(`\nSSTP Server: ${status}`);
        console.log(`  Enabled: ${sstpServer[0].disabled === 'false' ? 'Yes' : 'No'}`);
        if (sstpServer[0].port) {
          console.log(`  Port: ${sstpServer[0].port}`);
        }
      } else {
        console.log('\nSSTP Server không được cấu hình.');
      }
      
      // Kết nối SSTP active
      const sstpActive = await api.write('/interface/sstp-server/active/print');
      console.log(`SSTP Active Connections: ${sstpActive.length}`);
      if (sstpActive.length > 0) {
        sstpActive.forEach(conn => {
          console.log(`- User: ${conn.name}, Address: ${conn.address}`);
          if (conn.uptime) {
            console.log(`  Uptime: ${conn.uptime}`);
          }
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin SSTP Server: ' + error.message);
    }
    
    // IPsec
    try {
      const ipsecProposals = await api.write('/ip/ipsec/proposal/print');
      console.log(`\nIPsec Proposals: ${ipsecProposals.length}`);
      if (ipsecProposals.length > 0) {
        ipsecProposals.forEach(prop => {
          console.log(`- Name: ${prop.name}, Auth: ${prop.auth}, Encrypt: ${prop.enc}`);
        });
      }
      
      const ipsecPeers = await api.write('/ip/ipsec/peer/print');
      console.log(`\nIPsec Peers: ${ipsecPeers.length}`);
      if (ipsecPeers.length > 0) {
        ipsecPeers.forEach(peer => {
          const status = peer.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${status} Address: ${peer.address || 'any'}`);
        });
      }
      
      const ipsecIdentities = await api.write('/ip/ipsec/identity/print');
      console.log(`\nIPsec Identities: ${ipsecIdentities.length}`);
      if (ipsecIdentities.length > 0) {
        ipsecIdentities.forEach(identity => {
          console.log(`- Peer: ${identity.peer}, Secret: ******`);
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin IPsec: ' + error.message);
    }
    
    // OpenVPN
    try {
      const ovpnServer = await api.write('/interface/ovpn-server/server/print');
      if (ovpnServer.length > 0) {
        const status = ovpnServer[0].disabled === 'false' ? '🟢' : '🔴';
        console.log(`\nOpenVPN Server: ${status}`);
        console.log(`  Port: ${ovpnServer[0].port || 'default'}`);
        console.log(`  Mode: ${ovpnServer[0].mode || 'default'}`);
      } else {
        console.log('\nOpenVPN Server không được cấu hình.');
      }
    } catch (error) {
      console.log('Không thể lấy thông tin OpenVPN Server: ' + error.message);
    }
    
    await api.close();
    console.log('\n✅ Kiểm tra hoàn tất. Đã ngắt kết nối.');
    
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

// Thực thi kiểm tra
testWirelessVPN();