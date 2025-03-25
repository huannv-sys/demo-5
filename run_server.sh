#!/bin/bash

# Script để chạy máy chủ MikroTik Controller trong terminal
# Chạy script này để chạy máy chủ và xem nhật ký trực tiếp

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

# Kiểm tra môi trường Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js không được cài đặt."
  print_message "Hãy cài đặt Node.js: sudo apt install nodejs"
  exit 1
fi

# Kiểm tra file server
if [ ! -f "server.mjs" ]; then
  print_error "File server.mjs không tồn tại."
  exit 1
fi

# Thông báo
print_message "Khởi động MikroTik Controller..."
print_message "Bạn có thể truy cập: http://localhost:3000"
print_warning "Nhấn Ctrl+C để dừng server"
echo ""

# Chạy server
node server.mjs