#!/usr/bin/env node

/**
 * Script nhanh để kiểm tra băng thông từ thiết bị MikroTik
 * Sử dụng: node quick-bandwidth.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]
 */

import { RouterOSAPI } from 'routeros-client';

// Lấy tham số từ dòng lệnh
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Thiếu tham số. Sử dụng: node quick-bandwidth.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]');
  process.exit(1);
}

const host = args[0];
const username = args[1];
const password = args[2];
const port = args[3] ? parseInt(args[3]) : 8728;

/**
 * Định dạng bitrate
 */
function formatBitrate(bits, decimals = 2) {
  if (bits === 0) return '0 bps';
  
  const k = 1000; // Sử dụng 1000 cho bit rates, không phải 1024
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  
  const i = Math.floor(Math.log(bits) / Math.log(k));
  
  return parseFloat((bits / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Định dạng bytes
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
 * Hàm chính để kiểm tra băng thông
 */
async function quickBandwidth() {
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
    
    // Lấy danh sách interface
    console.log('\n--- Interfaces ---');
    const interfaces = await api.write('/interface/print');
    
    // Lọc các interface đang hoạt động
    const activeInterfaces = interfaces.filter(iface => 
      iface.running === 'true' && iface.type !== 'loopback'
    ).slice(0, 2); // Giới hạn 2 interface
    
    if (activeInterfaces.length === 0) {
      console.log('Không có interface nào đang hoạt động.');
      await api.close();
      return;
    }
    
    // Thu thập dữ liệu ban đầu
    const initialData = {};
    for (const iface of activeInterfaces) {
      // Lấy dữ liệu traffic ban đầu
      const initialTraffic = await api.write('/interface/monitor-traffic', [
        `=interface=${iface.name}`,
        '=once='
      ]);
      
      if (initialTraffic && initialTraffic.length > 0) {
        const firstSample = initialTraffic[0];
        initialData[iface.name] = {
          rxBits: parseInt(firstSample['rx-bits-per-second'] || 0),
          txBits: parseInt(firstSample['tx-bits-per-second'] || 0)
        };
      }
    }
    
    // Đợi 3 giây
    console.log('Đợi 3 giây để thu thập dữ liệu...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Thu thập dữ liệu sau 3 giây
    console.log('\n--- Bandwidth ---');
    for (const iface of activeInterfaces) {
      if (!initialData[iface.name]) continue;
      
      const traffic = await api.write('/interface/monitor-traffic', [
        `=interface=${iface.name}`,
        '=once='
      ]);
      
      if (traffic && traffic.length > 0) {
        const sample = traffic[0];
        const rxBits = parseInt(sample['rx-bits-per-second'] || 0);
        const txBits = parseInt(sample['tx-bits-per-second'] || 0);
        
        console.log(`Interface: ${iface.name}`);
        console.log(`  Download (RX): ${formatBitrate(rxBits)}`);
        console.log(`  Upload (TX):   ${formatBitrate(txBits)}`);
        
        // Lấy thống kê từ interface
        const stats = await api.write('/interface/print', [
          `=.proplist=name,rx-byte,tx-byte,rx-packet,tx-packet,rx-error,tx-error,rx-drop,tx-drop`,
          `?name=${iface.name}`
        ]);
        
        if (stats && stats.length > 0) {
          const stat = stats[0];
          console.log(`  Total RX: ${formatBytes(parseInt(stat['rx-byte'] || 0))}`);
          console.log(`  Total TX: ${formatBytes(parseInt(stat['tx-byte'] || 0))}`);
        }
      }
    }
    
    await api.close();
    console.log('\n✅ Kiểm tra hoàn tất. Đã ngắt kết nối.');
    
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

// Thực thi kiểm tra
quickBandwidth();