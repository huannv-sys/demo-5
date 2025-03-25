#!/bin/bash

# Script cấu hình Nginx cho MikroTik Controller
# Sử dụng: ./configure-nginx.sh [port]

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
  print_error "Script này cần được chạy với quyền root"
  print_message "Vui lòng chạy lại với sudo: sudo $0"
  exit 1
fi

# Xác định port
APP_PORT=${1:-3000}
print_message "Sẽ sử dụng port: $APP_PORT"

# Kiểm tra xem Nginx đã được cài đặt chưa
if ! command -v nginx &> /dev/null; then
  print_error "Nginx chưa được cài đặt"
  print_message "Đang cài đặt Nginx..."
  apt-get update
  apt-get install -y nginx
fi

# Hiển thị thông tin
print_header "CẤU HÌNH NGINX CHO MIKROTIK CONTROLLER"

# Tạo cấu hình Nginx
print_message "Tạo cấu hình Nginx..."
cat > /etc/nginx/sites-available/mikrotik-controller << EOF
server {
    listen 80;
    server_name _;  # Thay thế bằng tên miền của bạn nếu có

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

# Kích hoạt cấu hình
print_message "Kích hoạt cấu hình..."
ln -sf /etc/nginx/sites-available/mikrotik-controller /etc/nginx/sites-enabled/

# Xóa cấu hình mặc định nếu tồn tại
if [ -f /etc/nginx/sites-enabled/default ]; then
  print_message "Xóa cấu hình mặc định..."
  rm -f /etc/nginx/sites-enabled/default
fi

# Kiểm tra cú pháp cấu hình
print_message "Kiểm tra cú pháp cấu hình Nginx..."
nginx_check=$(nginx -t 2>&1)

if [[ $nginx_check == *"successful"* ]]; then
  print_success "Kiểm tra cú pháp thành công"
  
  # Khởi động lại Nginx
  print_message "Khởi động lại Nginx..."
  systemctl restart nginx
  
  # Kiểm tra trạng thái Nginx
  if systemctl is-active --quiet nginx; then
    print_success "Nginx đã được khởi động lại thành công"
    
    # Hiển thị thông tin IP
    IP_ADDRESS=$(hostname -I | awk '{print $1}')
    print_header "THÔNG TIN TRUY CẬP"
    print_message "MikroTik Controller có thể được truy cập tại:"
    print_message "http://$IP_ADDRESS/"
    
    # Kiểm tra tường lửa
    if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
      print_message "Mở cổng 80 trên tường lửa UFW..."
      ufw allow 80/tcp
      print_success "Đã mở cổng 80"
    fi
    
  else
    print_error "Không thể khởi động lại Nginx"
    print_message "Kiểm tra lỗi với lệnh: systemctl status nginx"
  fi
else
  print_error "Kiểm tra cú pháp thất bại:"
  echo "$nginx_check"
fi

# Hướng dẫn cấu hình SSL (nếu muốn)
print_header "HƯỚNG DẪN CẤU HÌNH SSL (TÙY CHỌN)"
print_message "Để cấu hình SSL với Let's Encrypt, bạn có thể sử dụng:"
print_message "sudo apt-get install certbot python3-certbot-nginx"
print_message "sudo certbot --nginx -d tenmien.com"
print_message "Thay thế tenmien.com bằng tên miền thực của bạn."