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
      
      // Lấy thông tin traffic ban đầu
      const initialTraffic = await api.write('/interface/monitor-traffic', [
        '=interface=ether1',
        '=once='
      ]);
      
      const firstSample = initialTraffic[0] || {};
      const firstRxBits = parseInt(firstSample['rx-bits-per-second'] || 0);
      const firstTxBits = parseInt(firstSample['tx-bits-per-second'] || 0);
      
      // Đợi 3 giây
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Lấy thông tin traffic sau 3 giây
      const currentTraffic = await api.write('/interface/monitor-traffic', [
        '=interface=ether1',
        '=once='
      ]);
      
      const secondSample = currentTraffic[0] || {};
      const secondRxBits = parseInt(secondSample['rx-bits-per-second'] || 0);
      const secondTxBits = parseInt(secondSample['tx-bits-per-second'] || 0);
      
      console.log(`Interface: ether1`);
      console.log(`   Download: ${formatBitrate(secondRxBits)}`);
      console.log(`   Upload:   ${formatBitrate(secondTxBits)}`);
      
    } catch (error) {
      console.log('Không thể lấy thông tin băng thông: ' + error.message);
    }
    
    // Thông tin DHCP
    printSection('DHCP Clients');
    try {
      const dhcpLeases = await api.write('/ip/dhcp-server/lease/print');
      if (dhcpLeases.length === 0) {
        console.log('Không có client DHCP nào.');
      } else {
        dhcpLeases.forEach(lease => {
          const active = lease['status'] === 'bound' ? '🟢' : '🔴';
          console.log(`${active} ${lease['host-name'] || 'Không tên'} - ${lease.address} (MAC: ${lease['mac-address']})`);
        });
      }
    } catch (error) {
      console.log('Không thể lấy thông tin DHCP: ' + error.message);
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