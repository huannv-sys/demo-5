#!/bin/bash

# Cài đặt MikroTik Controller
# Script này sẽ cài đặt và cấu hình MikroTik Controller trên Ubuntu

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

# Hàm kiểm tra lỗi
check_error() {
  if [ $? -ne 0 ]; then
    print_error "$1"
    exit 1
  fi
}

# Hiển thị banner
echo "======================================================"
echo "         MikroTik Controller - Cài đặt               "
echo "======================================================"
echo ""

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  print_error "Script này cần được chạy với quyền root (sudo)."
  exit 1
fi

# Cập nhật hệ thống
print_message "Đang cập nhật hệ thống..."
apt update && apt upgrade -y
check_error "Không thể cập nhật hệ thống."

# Cài đặt các gói phụ thuộc
print_message "Đang cài đặt các gói phụ thuộc..."
apt install -y nodejs npm nginx postgresql postgresql-contrib curl git
check_error "Không thể cài đặt các gói phụ thuộc."

# Kiểm tra phiên bản Node.js và npm
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
print_success "Đã cài đặt Node.js $NODE_VERSION và npm $NPM_VERSION"

# Kiểm tra và cài đặt phiên bản Node.js 20.x nếu cần
if [[ $NODE_VERSION != v20* ]]; then
  print_warning "Phiên bản Node.js hiện tại không phải là 20.x. Đang cài đặt Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  check_error "Không thể cài đặt Node.js 20.x"
  NODE_VERSION=$(node -v)
  print_success "Đã cài đặt Node.js $NODE_VERSION"
fi

# Tạo thư mục cài đặt
INSTALL_DIR="/opt/mikrotik-controller"
print_message "Tạo thư mục cài đặt tại $INSTALL_DIR..."
mkdir -p $INSTALL_DIR
check_error "Không thể tạo thư mục cài đặt."

# Thay đổi quyền sở hữu thư mục
chown -R $SUDO_USER:$SUDO_USER $INSTALL_DIR
check_error "Không thể thay đổi quyền sở hữu thư mục."

# Di chuyển vào thư mục cài đặt
cd $INSTALL_DIR
check_error "Không thể di chuyển vào thư mục cài đặt."

# Clone repository hoặc sao chép các tệp từ thư mục hiện tại
if [ -f "package.json" ]; then
  print_message "Phát hiện thấy package.json trong thư mục hiện tại. Sao chép tệp..."
  cp -R ./* $INSTALL_DIR/
  check_error "Không thể sao chép tệp."
else
  print_message "Đang tải mã nguồn từ repository..."
  git clone https://github.com/huannv-sys/demo2.0.git .
  check_error "Không thể tải mã nguồn từ repository."
fi

# Cài đặt các phụ thuộc npm
print_message "Đang cài đặt các phụ thuộc npm..."
npm install
check_error "Không thể cài đặt các phụ thuộc npm."

# Cấu hình PostgreSQL
print_message "Đang cấu hình PostgreSQL..."
# Kiểm tra xem PostgreSQL đã chạy chưa
systemctl is-active --quiet postgresql
if [ $? -ne 0 ]; then
  print_message "Khởi động dịch vụ PostgreSQL..."
  systemctl start postgresql
  systemctl enable postgresql
  check_error "Không thể khởi động PostgreSQL."
fi

# Tạo người dùng và cơ sở dữ liệu PostgreSQL
print_message "Tạo người dùng và cơ sở dữ liệu PostgreSQL..."
PG_USER="mikrouser"
PG_PASSWORD="4mRQ86Gkv1TuuR8f"
PG_DB="mikrotik_controller"

# Tạo người dùng và cơ sở dữ liệu
su - postgres -c "psql -c \"CREATE USER $PG_USER WITH PASSWORD '$PG_PASSWORD';\""
su - postgres -c "psql -c \"CREATE DATABASE $PG_DB;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $PG_DB TO $PG_USER;\""
su - postgres -c "psql -c \"ALTER USER $PG_USER WITH SUPERUSER;\""
print_success "Đã tạo người dùng và cơ sở dữ liệu PostgreSQL."

# Tạo tệp .env
print_message "Đang tạo tệp .env..."
cat > $INSTALL_DIR/.env << EOL
DATABASE_URL=postgres://$PG_USER:$PG_PASSWORD@localhost:5432/$PG_DB
USE_REAL_MIKROTIK_API=true
SESSION_SECRET=mikrotik-dashboard-secret
PORT=3000
EOL
check_error "Không thể tạo tệp .env."

# Tạo dịch vụ systemd
print_message "Tạo dịch vụ systemd cho MikroTik Controller..."
cat > /etc/systemd/system/mikrotik-controller.service << EOL
[Unit]
Description=MikroTik Controller
After=network.target postgresql.service

[Service]
ExecStart=/usr/bin/node $INSTALL_DIR/server.js
WorkingDirectory=$INSTALL_DIR
User=$SUDO_USER
Group=$SUDO_USER
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL
check_error "Không thể tạo dịch vụ systemd."

# Cấu hình tệp nginx
print_message "Cấu hình Nginx..."
cat > /etc/nginx/sites-available/mikrotik-controller << EOL
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL
check_error "Không thể tạo tệp cấu hình Nginx."

# Kích hoạt trang Nginx và vô hiệu hóa trang mặc định
ln -sf /etc/nginx/sites-available/mikrotik-controller /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
check_error "Không thể kích hoạt trang Nginx."

# Kiểm tra cấu hình Nginx
nginx -t
check_error "Cấu hình Nginx không hợp lệ."

# Khởi động lại Nginx
print_message "Khởi động lại Nginx..."
systemctl restart nginx
check_error "Không thể khởi động lại Nginx."

# Khởi động dịch vụ MikroTik Controller
print_message "Khởi động dịch vụ MikroTik Controller..."
systemctl daemon-reload
systemctl enable mikrotik-controller
systemctl start mikrotik-controller
check_error "Không thể khởi động dịch vụ MikroTik Controller."

# Kiểm tra trạng thái
print_message "Kiểm tra trạng thái dịch vụ..."
systemctl status mikrotik-controller --no-pager
check_error "Dịch vụ MikroTik Controller không chạy."

# Hoàn thành
print_success "Cài đặt MikroTik Controller hoàn tất!"
echo ""
echo "============================================================"
echo "  MikroTik Controller đã được cài đặt và đang chạy!"
echo "  Truy cập: http://your-server-ip"
echo "  Cơ sở dữ liệu: PostgreSQL"
echo "  Người dùng DB: $PG_USER"
echo "  Cơ sở dữ liệu: $PG_DB"
echo "  Thư mục cài đặt: $INSTALL_DIR"
echo "  Service: mikrotik-controller.service"
echo "============================================================"