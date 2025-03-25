#!/bin/bash

# Script cấu hình Nginx cho MikroTik Controller
# Cần được chạy với quyền root (sudo)

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

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  print_error "Script này cần được chạy với quyền root (sudo)."
  exit 1
fi

# Hiển thị banner
echo "======================================================"
echo "     Cấu hình Nginx cho MikroTik Controller          "
echo "======================================================"
echo ""

# Kiểm tra xem nginx đã được cài đặt chưa
if ! command -v nginx &> /dev/null; then
  print_warning "Nginx chưa được cài đặt. Đang cài đặt..."
  apt update && apt install -y nginx
  if [ $? -ne 0 ]; then
    print_error "Không thể cài đặt Nginx. Vui lòng cài đặt thủ công: apt install nginx"
    exit 1
  fi
  print_success "Đã cài đặt Nginx"
fi

# Lấy địa chỉ IP hoặc tên miền
SERVER_NAME="_"
if [ "$#" -ge 1 ]; then
  SERVER_NAME="$1"
  print_message "Cấu hình cho tên miền/địa chỉ IP: $SERVER_NAME"
else
  print_message "Không có tên miền cụ thể, sử dụng cấu hình mặc định"
fi

# Lấy cổng API
API_PORT="${2:-3000}"
print_message "Sử dụng cổng API: $API_PORT"

# Tạo tệp cấu hình Nginx
print_message "Tạo tệp cấu hình Nginx..."
cat > /etc/nginx/sites-available/mikrotik-controller << EOL
server {
    listen 80;
    server_name $SERVER_NAME;

    location / {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Kích hoạt trang và vô hiệu hóa trang mặc định
ln -sf /etc/nginx/sites-available/mikrotik-controller /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Kiểm tra cấu hình Nginx
print_message "Kiểm tra cấu hình Nginx..."
nginx -t
if [ $? -ne 0 ]; then
  print_error "Cấu hình Nginx không hợp lệ. Vui lòng kiểm tra lại."
  exit 1
fi

# Khởi động lại Nginx
print_message "Khởi động lại Nginx..."
systemctl restart nginx
if [ $? -ne 0 ]; then
  print_error "Không thể khởi động lại Nginx. Vui lòng kiểm tra lại."
  exit 1
fi

print_success "Cấu hình Nginx hoàn tất!"
echo ""
echo "============================================================"
echo "  Nginx đã được cấu hình thành công!"
echo "  Bạn có thể truy cập MikroTik Controller qua:"
if [ "$SERVER_NAME" = "_" ]; then
  echo "  http://your-server-ip/"
else
  echo "  http://$SERVER_NAME/"
fi
echo "  (Các yêu cầu sẽ được chuyển tiếp đến localhost:$API_PORT)"
echo "============================================================"