#!/bin/bash

# Script kiểm tra kết nối MikroTik
# Sử dụng routeros-client trực tiếp để kiểm tra

# Hàm hiển thị thông báo
print_message() {
  echo -e "\e[1;34m[INFO]\e[0m $1"
}

print_success() {
  echo -e "\e[1;32m[SUCCESS]\e[0m $1"
}

print_error() {
  echo -e "\e[1;31m[ERROR]\e[0m $1"
}

print_warning() {
  echo -e "\e[1;33m[WARNING]\e[0m $1"
}

# Hiển thị banner
echo "======================================================"
echo "         Kiểm tra kết nối MikroTik                   "
echo "======================================================"
echo ""

# Kiểm tra xem người dùng đã cung cấp tham số chưa
if [ "$#" -lt 3 ]; then
  print_error "Sử dụng: $0 <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [cổng_api]"
  print_message "Ví dụ: $0 192.168.1.1 admin password 8728"
  exit 1
fi

# Lấy các tham số
ADDRESS="$1"
USERNAME="$2"
PASSWORD="$3"
PORT="${4:-8728}"

# Hiển thị thông tin kết nối
print_message "Thông tin kết nối:"
echo "  Địa chỉ IP: $ADDRESS"
echo "  Cổng API: $PORT"
echo "  Tên đăng nhập: $USERNAME"
echo ""

# Tạo script kiểm tra kết nối
TEMP_JS=$(mktemp)
cat > $TEMP_JS << EOL
const { RouterOSAPI } = require('routeros-client');

async function testConnection() {
  const api = new RouterOSAPI({
    host: '$ADDRESS',
    port: $PORT,
    user: '$USERNAME',
    password: '$PASSWORD',
    timeout: 5000,
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
    
    process.exit(0);
  } catch (error) {
    console.error('Lỗi:', error.message);
    if (api) {
      try {
        await api.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }
    process.exit(1);
  }
}

testConnection();
EOL

# Kiểm tra xem routeros-client đã được cài đặt chưa
if ! npm list -g routeros-client > /dev/null 2>&1; then
  print_warning "Gói routeros-client chưa được cài đặt, đang cài đặt..."
  npm install -g routeros-client
  if [ $? -ne 0 ]; then
    print_error "Không thể cài đặt routeros-client. Vui lòng cài đặt thủ công: npm install -g routeros-client"
    rm $TEMP_JS
    exit 1
  fi
  print_success "Đã cài đặt routeros-client"
fi

# Chạy script kiểm tra
print_message "Đang kiểm tra kết nối đến $ADDRESS:$PORT..."
node $TEMP_JS

# Kiểm tra kết quả
if [ $? -eq 0 ]; then
  print_success "Kiểm tra hoàn tất. Kết nối thành công!"
else
  print_error "Kiểm tra thất bại. Không thể kết nối đến router!"
  print_warning "Vui lòng kiểm tra lại các thông tin sau:"
  echo "  1. Địa chỉ IP và cổng API chính xác"
  echo "  2. Tên đăng nhập và mật khẩu chính xác"
  echo "  3. API service đã được bật trên router"
  echo "  4. Tường lửa cho phép kết nối đến cổng API"
fi

# Xóa script tạm
rm $TEMP_JS

echo ""
print_message "Để kiểm tra kết nối thông qua API backend, hãy sử dụng:"
echo "  ./add_mikrotik_device.sh \"Tên thiết bị\" $ADDRESS $PORT $USERNAME $PASSWORD"

echo ""