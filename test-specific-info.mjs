#!/usr/bin/env node

/**
 * Script để kiểm tra chi tiết một số thông tin từ thiết bị MikroTik
 * Sử dụng: node test-specific-info.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]
 */

import { RouterOSAPI } from 'routeros-client';

// Lấy tham số từ dòng lệnh
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Thiếu tham số. Sử dụng: node test-specific-info.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]');
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
 * Hàm chính để kiểm tra thông tin cụ thể từ MikroTik
 */
async function testSpecificInfo() {
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
    
    // Lấy thông tin IP Address
    printSection('IP Addresses');
    try {
      const addresses = await api.write('/ip/address/print');
      if (addresses.length === 0) {
        console.log('Không có địa chỉ IP nào được cấu hình.');
      } else {
        console.log(`Số lượng IP: ${addresses.length}`);
        addresses.forEach(addr => {
          console.log(`- Interface: ${addr.interface}, Address: ${addr.address}`);
          if (addr.network) {
            console.log(`  Network: ${addr.network}`);
          }
          if (addr.disabled === 'true') {
            console.log('  [Disabled]');
          }
        });
      }
    } catch (error) {
      console.log(`Lỗi khi lấy thông tin IP: ${error.message}`);
    }
    
    // Lấy thông tin DHCP Server
    printSection('DHCP Server');
    try {
      const dhcpServer = await api.write('/ip/dhcp-server/print');
      if (dhcpServer.length === 0) {
        console.log('Không có DHCP Server nào được cấu hình.');
      } else {
        console.log(`Số lượng DHCP Server: ${dhcpServer.length}`);
        dhcpServer.forEach(server => {
          const status = server.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${status} ${server.name} (Interface: ${server.interface})`);
          if (server['address-pool']) {
            console.log(`  Pool: ${server['address-pool']}`);
          }
        });
      }
      
      // Lấy thông tin DHCP Leases
      const dhcpLeases = await api.write('/ip/dhcp-server/lease/print');
      console.log(`\nSố lượng DHCP Leases: ${dhcpLeases.length}`);
      if (dhcpLeases.length > 0) {
        dhcpLeases.slice(0, 5).forEach(lease => { // Giới hạn 5 leases để hiển thị
          const status = lease.status || 'unknown';
          const statusIcon = status === 'bound' ? '🟢' : '🔴';
          console.log(`${statusIcon} ${lease['host-name'] || 'Unknown'} - ${lease.address}`);
          console.log(`  MAC: ${lease['mac-address']}, Server: ${lease.server}`);
        });
      }
    } catch (error) {
      console.log(`Lỗi khi lấy thông tin DHCP: ${error.message}`);
    }
    
    // Lấy thông tin Firewall
    printSection('Firewall Rules');
    try {
      const filterRules = await api.write('/ip/firewall/filter/print');
      console.log(`Số lượng Filter Rules: ${filterRules.length}`);
      
      if (filterRules.length > 0) {
        console.log('Top 5 filter rules:');
        filterRules.slice(0, 5).forEach((rule, index) => {
          const status = rule.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${status} [${index + 1}] Chain: ${rule.chain}, Action: ${rule.action}`);
          if (rule.comment) {
            console.log(`  Comment: ${rule.comment}`);
          }
        });
      }
      
      // Lấy thông tin NAT
      const natRules = await api.write('/ip/firewall/nat/print');
      console.log(`\nSố lượng NAT Rules: ${natRules.length}`);
      
      if (natRules.length > 0) {
        console.log('Top 5 NAT rules:');
        natRules.slice(0, 5).forEach((rule, index) => {
          const status = rule.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${status} [${index + 1}] Chain: ${rule.chain}, Action: ${rule.action}`);
          if (rule.comment) {
            console.log(`  Comment: ${rule.comment}`);
          }
        });
      }
    } catch (error) {
      console.log(`Lỗi khi lấy thông tin Firewall: ${error.message}`);
    }
    
    // Lấy thông tin Routing
    printSection('Routing');
    try {
      const routes = await api.write('/ip/route/print');
      console.log(`Số lượng Routes: ${routes.length}`);
      
      if (routes.length > 0) {
        routes.forEach((route, index) => {
          const status = route.active === 'true' ? '🟢' : '🔴';
          const dst = route['dst-address'] || '0.0.0.0/0';
          console.log(`${status} [${index + 1}] ${dst} via ${route.gateway || 'direct'}`);
        });
      }
    } catch (error) {
      console.log(`Lỗi khi lấy thông tin Routing: ${error.message}`);
    }
    
    // Lấy thông tin System Users
    printSection('System Users');
    try {
      const users = await api.write('/user/print');
      console.log(`Số lượng Users: ${users.length}`);
      
      if (users.length > 0) {
        users.forEach(user => {
          const status = user.disabled === 'false' ? '🟢' : '🔴';
          console.log(`${status} ${user.name} (Group: ${user.group})`);
        });
      }
    } catch (error) {
      console.log(`Lỗi khi lấy thông tin Users: ${error.message}`);
    }
    
    await api.close();
    console.log('\n✅ Kiểm tra hoàn tất. Đã ngắt kết nối.');
    
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

// Thực thi kiểm tra
testSpecificInfo();