#!/bin/bash

# Script thêm thiết bị MikroTik vào hệ thống
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

# Hiển thị banner
echo "======================================================"
echo "         Thêm thiết bị MikroTik                      "
echo "======================================================"
echo ""

# Kiểm tra xem người dùng đã cung cấp tham số chưa
if [ "$#" -ne 5 ] && [ "$#" -ne 6 ]; then
  print_error "Sử dụng: $0 <tên_thiết_bị> <địa_chỉ_ip> <cổng_api> <tên_đăng_nhập> <mật_khẩu> [mặc_định]"
  print_message "Ví dụ: $0 \"Router Chính\" 192.168.1.1 8728 admin password true"
  exit 1
fi

# Lấy các tham số
NAME="$1"
ADDRESS="$2"
PORT="$3"
USERNAME="$4"
PASSWORD="$5"
IS_DEFAULT="${6:-false}"

# Kiểm tra nếu là mặc định
if [ "$IS_DEFAULT" = "true" ] || [ "$IS_DEFAULT" = "1" ] || [ "$IS_DEFAULT" = "yes" ]; then
  IS_DEFAULT="true"
else
  IS_DEFAULT="false"
fi

# Hiển thị thông tin thiết bị
print_message "Thông tin thiết bị:"
echo "  Tên: $NAME"
echo "  Địa chỉ IP: $ADDRESS"
echo "  Cổng API: $PORT"
echo "  Tên đăng nhập: $USERNAME"
echo "  Thiết bị mặc định: $IS_DEFAULT"

# Xác nhận từ người dùng
read -p "Bạn có muốn tiếp tục? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  print_warning "Đã hủy thêm thiết bị."
  exit 0
fi

# Kiểm tra kết nối đến router
print_message "Đang kiểm tra kết nối đến router $ADDRESS:$PORT..."

# Tạo tệp JSON tạm thời
JSON_FILE=$(mktemp)
cat > $JSON_FILE << EOL
{
  "name": "$NAME",
  "address": "$ADDRESS",
  "port": $PORT,
  "username": "$USERNAME",
  "password": "$PASSWORD",
  "isDefault": $IS_DEFAULT
}
EOL

# Gửi yêu cầu API để tạo kết nối
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d @$JSON_FILE http://localhost:3000/api/connections)
rm $JSON_FILE

# Kiểm tra phản hồi
if [[ $RESPONSE == *"id"* ]]; then
  ID=$(echo $RESPONSE | grep -o '"id":[^,}]*' | sed 's/"id"://')
  print_success "Đã thêm thiết bị thành công với ID: $ID"
  print_message "Bạn có thể truy cập thiết bị tại http://localhost/devices"
else
  print_error "Không thể thêm thiết bị. Phản hồi:"
  echo $RESPONSE | json_pp
  exit 1
fi

echo ""
print_message "Để kiểm tra trạng thái kết nối, hãy sử dụng:"
echo "  curl http://localhost:3000/api/connections/$ID/status"

print_message "Để lấy thông tin tài nguyên router, hãy sử dụng:"
echo "  curl http://localhost:3000/api/connections/$ID/resources"

print_message "Để ngắt kết nối, hãy sử dụng:"
echo "  curl -X POST http://localhost:3000/api/connections/$ID/disconnect"

echo ""
print_success "Hoàn tất!"