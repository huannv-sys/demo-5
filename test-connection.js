// Script để kiểm tra kết nối đến thiết bị MikroTik
import { RouterOSAPI } from 'routeros-client';

async function testConnection() {
  console.log('Đang kiểm tra kết nối đến thiết bị MikroTik...');
  
  try {
    const api = new RouterOSAPI({
      host: '113.22.135.94',
      port: 8728,
      user: 'admin',
      password: 'Ictech123$',
      timeout: 5000,
    });

    console.log(`Kết nối đến ${api.host}:${api.port} với user ${api.user}...`);
    await api.connect();
    console.log('✅ Kết nối thành công!');
    
    // Lấy thông tin hệ thống
    console.log('Đang lấy thông tin thiết bị...');
    const resources = await api.write('/system/resource/print');
    const resource = resources[0];
    
    console.log('\n📊 THÔNG TIN THIẾT BỊ:\n');
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
    
    // Lấy danh sách interface
    console.log('\n📶 INTERFACE:\n');
    const interfaces = await api.write('/interface/print');
    
    interfaces.forEach(iface => {
      const status = iface.running === 'true' ? '🟢' : '🔴';
      const disabled = iface.disabled === 'true' ? ' (Disabled)' : '';
      console.log(`${status} ${iface.name} - ${iface.type || 'N/A'}${disabled}`);
    });
    
    // Lấy thông tin DHCP
    console.log('\n🌐 DHCP CLIENTS:\n');
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
    
    await api.close();
    console.log('\n✅ Kiểm tra hoàn tất. Đã ngắt kết nối.');
    
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
    process.exit(1);
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Thực thi kết nối
testConnection();