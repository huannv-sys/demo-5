#!/bin/bash

# Script cài đặt MikroTik Controller
# Cài đặt và cấu hình tự động hệ thống giám sát và quản lý thiết bị MikroTik

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

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  print_error "Script này cần được chạy với quyền root."
  print_message "Vui lòng chạy lại với sudo: sudo $0"
  exit 1
fi

# Thư mục cài đặt
INSTALL_DIR="/opt/mikrotik-controller"
DB_NAME="mikrotik_controller"
DB_USER="mikrotik"
DB_PASS=$(openssl rand -base64 12)
APP_PORT=3000

# Hiển thị banner
print_header "CÀI ĐẶT MIKROTIK CONTROLLER"
print_message "Hệ thống giám sát và quản lý thiết bị MikroTik"
print_message "Phiên bản: 1.0.0"
echo ""

# Kiểm tra hệ điều hành
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    print_warning "Hệ điều hành không được hỗ trợ chính thức. Script này được thiết kế cho Ubuntu/Debian."
    read -p "Bạn có muốn tiếp tục không? (y/n): " continue_install
    if [[ "$continue_install" != "y" && "$continue_install" != "Y" ]]; then
      print_message "Hủy cài đặt."
      exit 0
    fi
  fi
else
  print_warning "Không thể xác định hệ điều hành. Tiếp tục với rủi ro của bạn."
fi

# Cập nhật gói
print_message "Cập nhật danh sách gói..."
apt-get update

# Cài đặt các gói phụ thuộc
print_message "Cài đặt các gói phụ thuộc..."
apt-get install -y curl wget git nginx postgresql postgresql-contrib python3 python3-pip

# Kiểm tra và cài đặt Node.js
if ! command -v node &> /dev/null; then
  print_message "Cài đặt Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Kiểm tra phiên bản Node.js
NODE_VERSION=$(node -v)
print_message "Phiên bản Node.js: $NODE_VERSION"

# Tạo thư mục cài đặt
print_message "Tạo thư mục cài đặt: $INSTALL_DIR"
mkdir -p $INSTALL_DIR

# Lấy vị trí hiện tại
CURRENT_DIR=$(pwd)

# Sao chép tất cả các file từ thư mục hiện tại
print_message "Sao chép các file vào thư mục cài đặt..."
cp -r $CURRENT_DIR/* $INSTALL_DIR/

# Di chuyển vào thư mục cài đặt
cd $INSTALL_DIR

# Đặt quyền thực thi cho các script
print_message "Đặt quyền thực thi cho các script..."
chmod +x *.sh

# Cài đặt các gói Node.js
print_message "Cài đặt các gói Node.js..."
npm install

# Cài đặt các gói Python
print_message "Cài đặt các gói Python..."
pip3 install requests trafilatura

# Tạo file .env
print_message "Tạo file cấu hình .env..."
cat > $INSTALL_DIR/.env << EOF
# Cấu hình MikroTik Controller
PORT=$APP_PORT
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
USE_REAL_MIKROTIK_API=true
EOF

# Cấu hình PostgreSQL
print_message "Cấu hình cơ sở dữ liệu PostgreSQL..."

# Kiểm tra xem PostgreSQL đã chạy chưa
if ! systemctl is-active --quiet postgresql; then
  print_message "Khởi động dịch vụ PostgreSQL..."
  systemctl start postgresql
  systemctl enable postgresql
fi

# Tạo người dùng và cơ sở dữ liệu PostgreSQL
print_message "Tạo người dùng và cơ sở dữ liệu PostgreSQL..."
su - postgres << EOF
psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
psql -c "CREATE DATABASE $DB_NAME;"
psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
psql -c "ALTER USER $DB_USER WITH SUPERUSER;"
EOF

# Tạo cấu trúc cơ sở dữ liệu
print_message "Tạo cấu trúc cơ sở dữ liệu..."
su - postgres << EOF
psql -d $DB_NAME << EOSQL
CREATE TABLE IF NOT EXISTS router_connections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 8728,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_connected TIMESTAMP
);

CREATE TABLE IF NOT EXISTS log_entries (
  id SERIAL PRIMARY KEY,
  router_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  level VARCHAR(50) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (router_id) REFERENCES router_connections(id) ON DELETE CASCADE
);
EOSQL
EOF

# Cấu hình Nginx
print_message "Cấu hình Nginx..."
cat > /etc/nginx/sites-available/mikrotik-controller << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Kích hoạt cấu hình Nginx
print_message "Kích hoạt cấu hình Nginx..."
ln -sf /etc/nginx/sites-available/mikrotik-controller /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default # Xóa cấu hình mặc định
systemctl reload nginx

# Tạo dịch vụ systemd
print_message "Tạo dịch vụ systemd..."
cat > /etc/systemd/system/mikrotik-controller.service << EOF
[Unit]
Description=MikroTik Controller Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/server.mjs
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=mikrotik-controller
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
print_message "Khởi động lại systemd..."
systemctl daemon-reload

# Khởi động dịch vụ
print_message "Khởi động dịch vụ MikroTik Controller..."
systemctl enable mikrotik-controller
systemctl start mikrotik-controller

# Kiểm tra dịch vụ
print_message "Kiểm tra trạng thái dịch vụ..."
if systemctl is-active --quiet mikrotik-controller; then
  print_success "Dịch vụ MikroTik Controller đã được khởi động thành công!"
else
  print_warning "Dịch vụ không được khởi động tự động. Kiểm tra lỗi với lệnh: sudo systemctl status mikrotik-controller"
fi

# Thông tin kết nối
IP_ADDRESS=$(hostname -I | awk '{print $1}')
print_header "THÔNG TIN KẾT NỐI"
print_message "MikroTik Controller đã được cài đặt thành công!"
print_message "Bạn có thể truy cập giao diện web tại: http://$IP_ADDRESS/"
print_message "Thư mục cài đặt: $INSTALL_DIR"
print_message "Nhật ký: sudo journalctl -u mikrotik-controller -f"

# Thông tin cơ sở dữ liệu
print_header "THÔNG TIN CƠ SỞ DỮ LIỆU"
print_message "Tên cơ sở dữ liệu: $DB_NAME"
print_message "Người dùng: $DB_USER"
print_message "Mật khẩu: $DB_PASS"
print_warning "Lưu ý: Hãy lưu thông tin này ở nơi an toàn!"

# Hướng dẫn thêm thiết bị
print_header "HƯỚNG DẪN TIẾP THEO"
print_message "Để thêm thiết bị MikroTik đầu tiên, sử dụng lệnh:"
print_message "sudo $INSTALL_DIR/add_mikrotik_device.sh \"Tên thiết bị\" \"Địa chỉ IP\" \"8728\" \"tên đăng nhập\" \"mật khẩu\" \"true\""
print_message "Ví dụ:"
print_message "sudo $INSTALL_DIR/add_mikrotik_device.sh \"Router Chính\" \"192.168.1.1\" \"8728\" \"admin\" \"password\" \"true\""
echo ""
print_message "Để xem thêm hướng dẫn, tham khảo: $INSTALL_DIR/README.md"
print_message "Hoặc tìm hiểu cách khắc phục sự cố: $INSTALL_DIR/troubleshooting.md"
echo ""
print_success "Cài đặt hoàn tất!"