#!/bin/bash

# Script kiểm tra kết nối đến MikroTik Controller
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

# Lấy địa chỉ IP máy chủ
SERVER_IP=$(hostname -I | awk '{print $1}')
DOMAIN="localhost"

print_header "Kiểm tra MikroTik Controller"
echo -e "Địa chỉ máy chủ: ${GREEN}$SERVER_IP${NC}"

# Kiểm tra các dịch vụ có đang chạy không
echo ""
print_header "Kiểm tra trạng thái dịch vụ"

echo "MikroTik Controller:"
systemctl is-active --quiet mikrotik-controller
if [ $? -eq 0 ]; then
    print_success "Dịch vụ MikroTik Controller đang chạy"
else
    print_error "Dịch vụ MikroTik Controller không chạy"
    echo "Thử khởi động lại dịch vụ:"
    echo "sudo systemctl restart mikrotik-controller"
fi

echo ""
echo "Nginx:"
systemctl is-active --quiet nginx
if [ $? -eq 0 ]; then
    print_success "Dịch vụ Nginx đang chạy"
else
    print_error "Dịch vụ Nginx không chạy"
    echo "Thử khởi động lại dịch vụ:"
    echo "sudo systemctl restart nginx"
fi

# Kiểm tra cổng 5000 (MikroTik API)
echo ""
print_header "Kiểm tra cổng 5000 (MikroTik API)"
nc -z -v -w5 localhost 5000 2>&1
if [ $? -eq 0 ]; then
    print_success "Cổng 5000 đang mở"
else
    print_error "Cổng 5000 không mở hoặc không thể kết nối"
    echo "Kiểm tra xem ứng dụng đã được cấu hình để chạy trên cổng 5000 chưa"
fi

# Kiểm tra cổng 80 (Nginx)
echo ""
print_header "Kiểm tra cổng 80 (Nginx)"
nc -z -v -w5 localhost 80 2>&1
if [ $? -eq 0 ]; then
    print_success "Cổng 80 đang mở"
else
    print_error "Cổng 80 không mở hoặc không thể kết nối"
    echo "Kiểm tra Nginx có đang chạy không:"
    echo "sudo systemctl status nginx"
fi

# Kiểm tra kết nối HTTP
echo ""
print_header "Kiểm tra kết nối HTTP"

echo "Truy cập trực tiếp (cổng 5000):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000
if [ $? -eq 0 ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Kết nối thành công đến http://localhost:5000 (HTTP 200)"
    else
        print_warning "Kết nối đến http://localhost:5000 trả về mã HTTP $HTTP_CODE"
    fi
else
    print_error "Không thể kết nối đến http://localhost:5000"
fi

echo ""
echo "Thông qua Nginx (cổng 80):"
curl -s -o /dev/null -w "%{http_code}" http://localhost
if [ $? -eq 0 ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost)
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Kết nối thành công đến http://localhost (HTTP 200)"
    else
        print_warning "Kết nối đến http://localhost trả về mã HTTP $HTTP_CODE"
    fi
else
    print_error "Không thể kết nối đến http://localhost"
fi

# Kiểm tra logs
echo ""
print_header "Kiểm tra logs"

echo "MikroTik Controller logs (5 dòng gần nhất):"
journalctl -u mikrotik-controller -n 5 --no-pager

echo ""
echo "Nginx logs (5 dòng gần nhất):"
journalctl -u nginx -n 5 --no-pager

# Thông tin tổng kết
echo ""
print_header "Thông tin truy cập"
echo "Truy cập ứng dụng tại:"
echo "- Local: ${GREEN}http://localhost${NC}"
echo "- Mạng nội bộ: ${GREEN}http://$SERVER_IP${NC}"
echo ""
echo "Nếu gặp lỗi, vui lòng kiểm tra hướng dẫn khắc phục sự cố trong file troubleshooting.md"