#!/usr/bin/env node

/**
 * Script để giám sát băng thông từ thiết bị MikroTik
 * Sử dụng: node test-bandwidth.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]
 */

import { RouterOSAPI } from 'routeros-client';

// Lấy tham số từ dòng lệnh
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Thiếu tham số. Sử dụng: node test-bandwidth.mjs <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [<cổng>]');
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
 * Tạo biểu đồ đơn giản từ dữ liệu hiện tại
 */
function createGraph(value, max, width = 50) {
  const percent = Math.min(100, (value / max) * 100);
  const bars = Math.floor((percent / 100) * width);
  
  let graph = '';
  for (let i = 0; i < width; i++) {
    graph += i < bars ? '█' : '░';
  }
  
  return `${graph} ${percent.toFixed(1)}%`;
}

/**
 * Hàm chính để kiểm tra băng thông
 */
async function testBandwidth() {
  console.log('Đang kết nối đến thiết bị MikroTik...');
  
  try {
    console.log(`Kết nối đến ${host}:${port} với user ${username}...`);
    
    const api = new RouterOSAPI({
      host,
      port,
      user: username,
      password,
      timeout: 10000,
    });

    await api.connect();
    console.log('✅ Kết nối thành công!');
    
    // Lấy danh sách interface
    printSection('Network Interfaces');
    const interfaces = await api.write('/interface/print');
    console.log(`Số lượng interfaces: ${interfaces.length}`);
    
    // Lọc các interface đang hoạt động
    const activeInterfaces = interfaces.filter(iface => 
      iface.running === 'true' && iface.type !== 'loopback'
    );
    
    if (activeInterfaces.length === 0) {
      console.log('Không có interface nào đang hoạt động.');
      await api.close();
      return;
    }
    
    // Hiển thị thông tin interfaces
    activeInterfaces.forEach(iface => {
      const status = iface.running === 'true' ? '🟢' : '🔴';
      console.log(`${status} ${iface.name} (${iface.type || 'unknown'})`);
      console.log(`  MAC: ${iface['mac-address'] || 'N/A'}, MTU: ${iface.mtu || 'default'}`);
      if (iface.disabled === 'true') {
        console.log(`  [Disabled]`);
      }
    });
    
    // Giám sát băng thông trong 10 giây
    printSection('Bandwidth Monitoring (10 seconds)');
    console.log('Đang thu thập dữ liệu băng thông...');
    
    // Lưu dữ liệu ban đầu
    const interfaceData = {};
    for (const iface of activeInterfaces) {
      // Lấy dữ liệu traffic ban đầu
      const initialTraffic = await api.write('/interface/monitor-traffic', [
        `=interface=${iface.name}`,
        '=once='
      ]);
      
      if (!initialTraffic || initialTraffic.length === 0) {
        console.log(`⚠️ Không thể lấy dữ liệu traffic cho ${iface.name}`);
        continue;
      }
      
      const firstSample = initialTraffic[0];
      
      // Lấy thống kê interface
      const stats = await api.write('/interface/print', [
        `=.proplist=name,rx-byte,tx-byte,rx-packet,tx-packet,rx-error,tx-error,rx-drop,tx-drop`,
        `?name=${iface.name}`
      ]);
      
      interfaceData[iface.name] = {
        firstSample,
        stats: stats[0] || {},
        samples: [
          {
            timestamp: Date.now(),
            rxBits: parseInt(firstSample['rx-bits-per-second'] || 0),
            txBits: parseInt(firstSample['tx-bits-per-second'] || 0)
          }
        ]
      };
    }
    
    // Thu thập mẫu trong 10 giây, mỗi giây lấy 1 mẫu
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      for (const iface of activeInterfaces) {
        if (!interfaceData[iface.name]) continue;
        
        const traffic = await api.write('/interface/monitor-traffic', [
          `=interface=${iface.name}`,
          '=once='
        ]);
        
        if (!traffic || traffic.length === 0) continue;
        
        const sample = traffic[0];
        interfaceData[iface.name].samples.push({
          timestamp: Date.now(),
          rxBits: parseInt(sample['rx-bits-per-second'] || 0),
          txBits: parseInt(sample['tx-bits-per-second'] || 0)
        });
        
        // Hiển thị dữ liệu theo thời gian thực
        process.stdout.write(`${iface.name}: RX ${formatBitrate(parseInt(sample['rx-bits-per-second'] || 0))}, TX ${formatBitrate(parseInt(sample['tx-bits-per-second'] || 0))}${i < 9 ? '... ' : '\\r\\n'}`);
      }
      
      // Xuống dòng sau mỗi lần cập nhật
      console.log();
    }
    
    // Hiển thị báo cáo tổng hợp
    printSection('Bandwidth Summary');
    
    for (const ifaceName in interfaceData) {
      const data = interfaceData[ifaceName];
      const samples = data.samples;
      
      if (samples.length < 2) {
        console.log(`${ifaceName}: Không đủ dữ liệu để phân tích`);
        continue;
      }
      
      // Tính toán dữ liệu tổng hợp
      let maxRx = 0, maxTx = 0, totalRx = 0, totalTx = 0;
      
      for (let i = 1; i < samples.length; i++) {
        const rxBits = samples[i].rxBits;
        const txBits = samples[i].txBits;
        
        maxRx = Math.max(maxRx, rxBits);
        maxTx = Math.max(maxTx, txBits);
        totalRx += rxBits;
        totalTx += txBits;
      }
      
      const avgRx = totalRx / (samples.length - 1);
      const avgTx = totalTx / (samples.length - 1);
      
      // Hiển thị dữ liệu tổng hợp
      console.log(`\nInterface: ${ifaceName}`);
      console.log(`Average Download: ${formatBitrate(avgRx)}`);
      console.log(`Average Upload:   ${formatBitrate(avgTx)}`);
      console.log(`Peak Download:    ${formatBitrate(maxRx)}`);
      console.log(`Peak Upload:      ${formatBitrate(maxTx)}`);
      
      // Hiển thị biểu đồ
      console.log(`\nDownload: ${createGraph(avgRx, maxRx)} (Avg/Peak)`);
      console.log(`Upload:   ${createGraph(avgTx, maxTx)} (Avg/Peak)`);
      
      // Hiển thị thống kê byte total
      if (data.stats) {
        const stats = data.stats;
        console.log(`\nTotal RX: ${formatBytes(parseInt(stats['rx-byte'] || 0))}`);
        console.log(`Total TX: ${formatBytes(parseInt(stats['tx-byte'] || 0))}`);
        console.log(`Packets RX/TX: ${stats['rx-packet'] || 0} / ${stats['tx-packet'] || 0}`);
        
        const rxErrors = parseInt(stats['rx-error'] || 0);
        const txErrors = parseInt(stats['tx-error'] || 0);
        const rxDrops = parseInt(stats['rx-drop'] || 0);
        const txDrops = parseInt(stats['tx-drop'] || 0);
        
        if (rxErrors > 0 || txErrors > 0 || rxDrops > 0 || txDrops > 0) {
          console.log(`Errors RX/TX: ${rxErrors} / ${txErrors}`);
          console.log(`Drops RX/TX: ${rxDrops} / ${txDrops}`);
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
testBandwidth();