#!/bin/bash

# Script cấu hình Nginx làm reverse proxy cho MikroTik Controller
# Phiên bản: 1.0

# Đặt màu cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hàm hiển thị tiêu đề
print_header() {
  echo -e "${BLUE}===== $1 =====${NC}"
}

# Hàm hiển thị thông báo thành công
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# Hàm hiển thị cảnh báo
print_warning() {
  echo -e "${YELLOW}⚠️ $1${NC}"
}

# Hàm hiển thị lỗi
print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Kiểm tra quyền root
if [ "$(id -u)" != "0" ]; then
   print_error "Script này cần chạy với quyền root (sudo)"
   exit 1
fi

# Kiểm tra Nginx đã được cài đặt
print_header "Kiểm tra Nginx"
if ! command -v nginx &> /dev/null; then
    print_warning "Nginx chưa được cài đặt. Đang cài đặt..."
    apt update
    apt install -y nginx
    print_success "Đã cài đặt Nginx"
else
    print_success "Nginx đã được cài đặt"
fi

# Kiểm tra MikroTik Controller service
print_header "Kiểm tra MikroTik Controller"
if ! systemctl is-active --quiet mikrotik-controller; then
    print_warning "Dịch vụ MikroTik Controller chưa chạy. Vui lòng cài đặt trước khi cấu hình Nginx."
fi

# Lấy đường dẫn hiện tại của MikroTik Controller
MIKROTIK_PATH=""
if systemctl status mikrotik-controller &> /dev/null; then
    MIKROTIK_PATH=$(systemctl status mikrotik-controller | grep "WorkingDirectory" | awk '{print $2}')
fi

if [ -z "$MIKROTIK_PATH" ]; then
    # Tìm đường dẫn dựa trên thư mục home của người dùng
    MIKROTIK_PATH=$(find /home -name "mikrotik-controller" -type d 2>/dev/null | head -n 1)
    
    if [ -z "$MIKROTIK_PATH" ]; then
        print_warning "Không thể tự động tìm thấy đường dẫn MikroTik Controller"
        read -p "Nhập đường dẫn đến thư mục MikroTik Controller: " MIKROTIK_PATH
    fi
fi

print_success "Đường dẫn MikroTik Controller: $MIKROTIK_PATH"

# Tạo file cấu hình Nginx
print_header "Tạo cấu hình Nginx"

# Lấy địa chỉ IP máy chủ
SERVER_IP=$(hostname -I | awk '{print $1}')
print_success "Địa chỉ IP máy chủ: $SERVER_IP"

# Tạo file cấu hình Nginx
cat > /etc/nginx/sites-available/mikrotik << EOL
server {
    listen 80;
    server_name localhost $SERVER_IP;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL

print_success "Đã tạo file cấu hình Nginx"

# Bật cấu hình
if [ -f /etc/nginx/sites-enabled/mikrotik ]; then
    rm /etc/nginx/sites-enabled/mikrotik
fi

ln -s /etc/nginx/sites-available/mikrotik /etc/nginx/sites-enabled/
print_success "Đã kích hoạt cấu hình Nginx"

# Cập nhật file service để chạy trên port 5000
print_header "Cập nhật cấu hình MikroTik Controller"

# Kiểm tra xem file run-mikrotik đã tồn tại
if [ -f /usr/local/bin/run-mikrotik ]; then
    # Cập nhật run-mikrotik để đặt PORT=5000
    sed -i 's/NODE_ENV=production npm run start/NODE_ENV=production PORT=5000 npm run start/g' /usr/local/bin/run-mikrotik
    print_success "Đã cập nhật script run-mikrotik với PORT=5000"
else
    print_warning "Không tìm thấy script run-mikrotik. Tạo mới..."
    
    # Tạo script run-mikrotik mới
    cat > /usr/local/bin/run-mikrotik << EOL
#!/bin/bash

# Script để xây dựng và chạy MikroTik Controller
# Phiên bản: 1.0
WORKING_DIR="$MIKROTIK_PATH"

# Xây dựng frontend
cd "\$WORKING_DIR"
echo "Đang xây dựng ứng dụng..."
npm run build

# Chạy backend với static files từ thư mục build
echo "Khởi động ứng dụng..."
NODE_ENV=production PORT=5000 npm run start
EOL

    chmod +x /usr/local/bin/run-mikrotik
    ln -sf /usr/local/bin/run-mikrotik /usr/bin/run-mikrotik
    print_success "Đã tạo script run-mikrotik mới với PORT=5000"
fi

# Cập nhật file service nếu cần
if grep -q "Environment=PORT=5000" /etc/systemd/system/mikrotik-controller.service; then
    print_success "File service đã có cấu hình PORT=5000"
else
    sed -i '/Environment=/a Environment=PORT=5000' /etc/systemd/system/mikrotik-controller.service
    print_success "Đã thêm cấu hình PORT=5000 vào file service"
fi

# Kiểm tra cú pháp Nginx
print_header "Kiểm tra cú pháp Nginx"
nginx -t
if [ $? -ne 0 ]; then
    print_error "Cú pháp Nginx không hợp lệ. Vui lòng kiểm tra lại."
    exit 1
fi

# Khởi động lại các dịch vụ
print_header "Khởi động lại dịch vụ"
systemctl daemon-reload
systemctl restart mikrotik-controller
systemctl reload nginx

# Kiểm tra trạng thái
sleep 5
if systemctl is-active --quiet nginx && systemctl is-active --quiet mikrotik-controller; then
    print_success "Cấu hình hoàn tất. Dịch vụ đang chạy."
else
    print_warning "Có lỗi xảy ra. Vui lòng kiểm tra trạng thái dịch vụ:"
    systemctl status nginx
    systemctl status mikrotik-controller
fi

# Thông báo hoàn thành
print_header "Cấu hình hoàn tất!"
echo -e "${GREEN}MikroTik Controller đã được cấu hình với Nginx thành công.${NC}"
echo ""
echo -e "${BLUE}Thông tin truy cập:${NC}"
echo "- Truy cập ứng dụng tại: ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo "Bạn có thể kiểm tra trạng thái dịch vụ:"
echo "- Nginx: ${GREEN}systemctl status nginx${NC}"
echo "- MikroTik Controller: ${GREEN}systemctl status mikrotik-controller${NC}"
echo ""
echo "Nếu bạn gặp lỗi, vui lòng kiểm tra:"
echo "- Logs Nginx: ${GREEN}journalctl -u nginx${NC}"
echo "- Logs MikroTik Controller: ${GREEN}journalctl -u mikrotik-controller${NC}"