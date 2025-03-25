import { RouterOSAPI } from 'routeros-client';

async function testConnection() {
  const api = new RouterOSAPI({
    host: '113.22.135.94',
    port: 8728,
    user: 'admin',
    password: 'Ictech123$',
    timeout: 10000,
  });

  try {
    console.log('Đang kết nối đến MikroTik...');
    await api.connect();
    console.log('Kết nối thành công!');
    
    console.log('\nĐang lấy thông tin hệ thống...');
    const resources = await api.write('/system/resource/print');
    console.log('Thông tin hệ thống:');
    console.log(JSON.stringify(resources[0], null, 2));
    
    console.log('\nĐang lấy danh sách interfaces...');
    const interfaces = await api.write('/interface/print');
    console.log('Số lượng interfaces:', interfaces.length);
    
    // Hiển thị 3 interface đầu tiên
    for (let i = 0; i < Math.min(3, interfaces.length); i++) {
      console.log('Interface', i + 1, ':', interfaces[i].name, 
                 '(Loại:', interfaces[i].type, 
                 ', Trạng thái:', interfaces[i].running === 'true' ? 'Đang chạy' : 'Dừng',
                 ')');
    }
    
    console.log('\nĐang ngắt kết nối...');
    await api.close();
    console.log('Đã ngắt kết nối!');
    
  } catch (error) {
    console.error('Lỗi:', error.message);
    if (api) {
      try {
        await api.close();
      } catch (closeError) {
        // Bỏ qua lỗi đóng kết nối
      }
    }
  }
}

testConnection();