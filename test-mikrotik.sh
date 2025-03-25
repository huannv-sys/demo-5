#!/bin/bash

# Script để kiểm tra kết nối đến thiết bị MikroTik
# Sử dụng: ./test-mikrotik.sh "địa_chỉ_ip" "tên_đăng_nhập" "mật_khẩu" "cổng"

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

print_header() {
  echo -e "\e[1;36m══════════════════════════════════════════════════\e[0m"
  echo -e "\e[1;36m $1 \e[0m"
  echo -e "\e[1;36m══════════════════════════════════════════════════\e[0m"
}

# Kiểm tra tham số đầu vào
if [ $# -lt 3 ]; then
  print_error "Thiếu tham số!"
  echo "Sử dụng: $0 \"địa_chỉ_ip\" \"tên_đăng_nhập\" \"mật_khẩu\" [cổng]"
  exit 1
fi

# Gán tham số
IP_ADDRESS=$1
USERNAME=$2
PASSWORD=$3
PORT=${4:-8728}  # Mặc định là 8728 nếu không được cung cấp

# Kiểm tra Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js không được cài đặt."
  print_message "Hãy cài đặt Node.js trước khi sử dụng công cụ này."
  exit 1
fi

# Thông báo cho người dùng
print_header "KIỂM TRA KẾT NỐI MIKROTIK"
print_message "Địa chỉ IP: $IP_ADDRESS"
print_message "Cổng: $PORT"
print_message "Tài khoản: $USERNAME"
print_message "Đang kiểm tra kết nối..."
echo ""

# Chạy script kiểm tra kết nối bằng Node.js
node test-connection.mjs "$IP_ADDRESS" "$USERNAME" "$PASSWORD" "$PORT"

# Kiểm tra kết quả
if [ $? -eq 0 ]; then
  print_success "Kết nối và kiểm tra thành công!"
else
  print_error "Có lỗi xảy ra khi kiểm tra kết nối."
  exit 1
fi