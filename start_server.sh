#!/bin/bash

# Script để khởi động máy chủ MikroTik Controller

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

# Đường dẫn cài đặt
INSTALL_DIR="/opt/mikrotik-controller"
if [ ! -d "$INSTALL_DIR" ]; then
  print_error "Thư mục cài đặt $INSTALL_DIR không tồn tại."
  print_message "Hãy chạy install.sh trước."
  exit 1
fi

# Di chuyển vào thư mục cài đặt
cd $INSTALL_DIR

# Kiểm tra xem server đã chạy chưa
PID_FILE="server.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat $PID_FILE)
  if ps -p $PID > /dev/null; then
    print_message "Server đã đang chạy với PID: $PID"
    print_message "Để khởi động lại, hãy chạy: sudo systemctl restart mikrotik-controller"
    exit 0
  else
    print_message "Tìm thấy PID file nhưng server không chạy. Xóa PID file cũ."
    rm $PID_FILE
  fi
fi

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

# Khởi động server
print_message "Khởi động MikroTik Controller..."
nohup node server.mjs > server.log 2>&1 &
echo $! > $PID_FILE

# Kiểm tra xem server đã khởi động thành công chưa
sleep 2
if ps -p $(cat $PID_FILE) > /dev/null; then
  print_success "MikroTik Controller đã khởi động thành công với PID: $(cat $PID_FILE)"
  print_message "Bạn có thể truy cập: http://localhost:3000"
  print_message "Hoặc truy cập qua Nginx (nếu đã cấu hình): http://your-server-ip"
  print_message "Nhật ký được lưu tại: $INSTALL_DIR/server.log"
else
  print_error "Khởi động thất bại. Kiểm tra nhật ký: $INSTALL_DIR/server.log"
  exit 1
fi