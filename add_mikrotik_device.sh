#!/bin/bash

# Script để thêm thiết bị MikroTik vào hệ thống giám sát
# Sử dụng: ./add_mikrotik_device.sh "tên" "địa_chỉ_ip" "cổng" "tên_đăng_nhập" "mật_khẩu" ["mặc_định"]

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

print_header() {
  echo -e "\e[1;36m══════════════════════════════════════════════════\e[0m"
  echo -e "\e[1;36m $1 \e[0m"
  echo -e "\e[1;36m══════════════════════════════════════════════════\e[0m"
}

# Kiểm tra tham số đầu vào
if [ $# -lt 5 ]; then
  print_error "Thiếu tham số!"
  echo "Sử dụng: $0 \"tên\" \"địa_chỉ_ip\" \"cổng\" \"tên_đăng_nhập\" \"mật_khẩu\" [\"mặc_định\"]"
  echo "Ví dụ: $0 \"Router Chính\" \"192.168.1.1\" \"8728\" \"admin\" \"password\" \"true\""
  exit 1
fi

# Gán tham số
DEVICE_NAME=$1
IP_ADDRESS=$2
PORT=$3
USERNAME=$4
PASSWORD=$5
IS_DEFAULT=${6:-"false"}

# Hiển thị thông tin thiết bị
print_header "THÊM THIẾT BỊ MIKROTIK"
print_message "Tên thiết bị: $DEVICE_NAME"
print_message "Địa chỉ IP: $IP_ADDRESS"
print_message "Cổng API: $PORT"
print_message "Tài khoản: $USERNAME"
print_message "Mặc định: $IS_DEFAULT"

# Kiểm tra kết nối trước khi thêm
print_message "Kiểm tra kết nối đến thiết bị..."

# Tạo script tạm thời để kiểm tra kết nối
TEST_SCRIPT=$(mktemp)

cat > $TEST_SCRIPT << EOF
import { RouterOSAPI } from 'routeros-client';

async function testConnection() {
  try {
    const api = new RouterOSAPI({
      host: '$IP_ADDRESS',
      port: $PORT,
      user: '$USERNAME',
      password: '$PASSWORD',
      timeout: 5000,
    });

    await api.connect();
    console.log('success');
    await api.close();
  } catch (error) {
    console.error('error', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

# Chạy kiểm tra
TEST_RESULT=$(node $TEST_SCRIPT 2>&1)
rm $TEST_SCRIPT

if [[ $TEST_RESULT == *"success"* ]]; then
  print_success "Kết nối thành công đến thiết bị MikroTik!"
else
  print_error "Không thể kết nối đến thiết bị MikroTik."
  print_error "Lỗi: ${TEST_RESULT#*error}"
  print_message "Vui lòng kiểm tra thông tin kết nối và thử lại."
  exit 1
fi

# Thêm thiết bị vào cơ sở dữ liệu
print_message "Thêm thiết bị vào cơ sở dữ liệu..."

# Tạo script để thêm thiết bị
DB_SCRIPT=$(mktemp)

cat > $DB_SCRIPT << EOF
import * as pg from 'pg';
import dotenv from 'dotenv';

// Load biến môi trường
dotenv.config();

async function addRouter() {
  // Kết nối đến PostgreSQL
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Nếu thiết bị là mặc định, cập nhật tất cả các thiết bị khác thành không mặc định
    if ('$IS_DEFAULT' === 'true') {
      await pool.query('UPDATE router_connections SET is_default = false');
    }

    // Thêm thiết bị mới
    const result = await pool.query(
      'INSERT INTO router_connections (name, address, port, username, password, is_default) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      ['$DEVICE_NAME', '$IP_ADDRESS', $PORT, '$USERNAME', '$PASSWORD', '$IS_DEFAULT' === 'true']
    );

    console.log(JSON.stringify(result.rows[0]));
  } catch (error) {
    console.error('error', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addRouter();
EOF

# Chạy script để thêm thiết bị vào cơ sở dữ liệu
DB_RESULT=$(node $DB_SCRIPT 2>&1)
rm $DB_SCRIPT

if [[ $DB_RESULT == *"error"* ]]; then
  print_error "Không thể thêm thiết bị vào cơ sở dữ liệu."
  print_error "Lỗi: ${DB_RESULT#*error}"
  exit 1
else
  print_success "Đã thêm thiết bị thành công!"
  
  # Hiển thị thông tin thiết bị đã thêm
  DEVICE_INFO=$(echo $DB_RESULT | grep -v "error")
  DEVICE_ID=$(echo $DEVICE_INFO | grep -o '"id":[0-9]*' | cut -d':' -f2)
  
  print_message "ID thiết bị: $DEVICE_ID"
  print_message "Thông tin thiết bị đã được lưu vào cơ sở dữ liệu."
  
  if [[ $IS_DEFAULT == "true" ]]; then
    print_message "Thiết bị này đã được đặt làm mặc định."
  fi
  
  print_message "Bạn có thể kết nối đến thiết bị này qua giao diện web hoặc sử dụng lệnh sau:"
  echo "  python mikrotik_monitor.py --router $DEVICE_ID"
fi