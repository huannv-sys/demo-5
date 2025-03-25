#!/bin/bash

# Script để thêm thiết bị MikroTik vào hệ thống giám sát
# Sử dụng cho Ubuntu 24.04

echo "===== Thêm thiết bị MikroTik vào hệ thống giám sát ====="

# Kiểm tra tham số command line cho địa chỉ máy chủ
if [ "$1" != "" ]; then
  SERVER_ADDRESS="$1"
else
  # Yêu cầu địa chỉ máy chủ từ người dùng
  read -p "Địa chỉ máy chủ (mặc định localhost): " SERVER_ADDRESS
  SERVER_ADDRESS=${SERVER_ADDRESS:-localhost}
fi

# Kiểm tra tham số cho cổng máy chủ
if [ "$2" != "" ]; then
  SERVER_PORT="$2"
else
  # Yêu cầu cổng máy chủ từ người dùng
  read -p "Cổng máy chủ (mặc định 3000): " SERVER_PORT
  SERVER_PORT=${SERVER_PORT:-3000}
fi

# Kiểm tra kết nối đến máy chủ
echo "Kiểm tra kết nối đến máy chủ $SERVER_ADDRESS:$SERVER_PORT..."
if ! curl -s -m 5 "http://$SERVER_ADDRESS:$SERVER_PORT/" > /dev/null; then
  echo "⚠️ Không thể kết nối đến máy chủ. Đảm bảo rằng:"
  echo "  1. Dịch vụ đã được khởi động (systemctl status mikrotik-controller)"
  echo "  2. Cổng $SERVER_PORT đã được mở trong firewall"
  echo "  3. Địa chỉ máy chủ chính xác"
  echo ""
  read -p "Bạn có muốn tiếp tục không? (y/n): " CONTINUE
  if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    echo "Hủy thao tác."
    exit 1
  fi
fi

# Yêu cầu thông tin thiết bị từ người dùng
read -p "Tên thiết bị: " DEVICE_NAME
read -p "Địa chỉ IP thiết bị MikroTik: " DEVICE_IP
read -p "Cổng API thiết bị MikroTik (mặc định 8728): " DEVICE_PORT
DEVICE_PORT=${DEVICE_PORT:-8728}
read -p "Tên đăng nhập thiết bị MikroTik: " DEVICE_USERNAME
read -s -p "Mật khẩu thiết bị MikroTik: " DEVICE_PASSWORD
echo ""
read -p "Đặt làm thiết bị mặc định? (y/n): " SET_DEFAULT
DEFAULT_FLAG="false"
if [[ "$SET_DEFAULT" == "y" || "$SET_DEFAULT" == "Y" ]]; then
  DEFAULT_FLAG="true"
fi

# Tạo JSON payload
JSON_PAYLOAD="{\"name\":\"$DEVICE_NAME\",\"address\":\"$DEVICE_IP\",\"port\":$DEVICE_PORT,\"username\":\"$DEVICE_USERNAME\",\"password\":\"$DEVICE_PASSWORD\",\"isDefault\":$DEFAULT_FLAG}"

echo "===== Đang thêm thiết bị vào hệ thống ====="
echo "Thông tin thiết bị:"
echo "- Tên: $DEVICE_NAME"
echo "- Địa chỉ IP: $DEVICE_IP"
echo "- Cổng: $DEVICE_PORT"
echo "- Người dùng: $DEVICE_USERNAME"
echo "- Mặc định: $DEFAULT_FLAG"

# Gửi yêu cầu đến API
API_URL="http://$SERVER_ADDRESS:$SERVER_PORT/api/connections"

echo "Đang gửi yêu cầu đến $API_URL"
echo "Đang thực hiện..."

# Thêm thêm thông tin debug và timeout
RESPONSE=$(curl -s -v -m 10 -X POST -H "Content-Type: application/json" -d "$JSON_PAYLOAD" "$API_URL" 2>&1)
CURL_EXIT_CODE=$?

# Kiểm tra kết quả curl
if [ $CURL_EXIT_CODE -ne 0 ]; then
  echo "===== Lỗi kết nối ====="
  echo "Không thể kết nối đến API. Mã lỗi: $CURL_EXIT_CODE"
  echo "Chi tiết:"
  
  if [ $CURL_EXIT_CODE -eq 7 ]; then
    echo "  - Không thể kết nối đến máy chủ. Kiểm tra địa chỉ và cổng."
  elif [ $CURL_EXIT_CODE -eq 28 ]; then
    echo "  - Kết nối bị timeout. Máy chủ có thể quá tải hoặc không phản hồi."
  fi
  
  echo "Thông tin debug:"
  echo "$RESPONSE"
  echo ""
  echo "Vui lòng thực hiện các bước sau để kiểm tra:"
  echo "1. Chạy 'curl -v http://$SERVER_ADDRESS:$SERVER_PORT/' để kiểm tra kết nối chung"
  echo "2. Đảm bảo rằng dịch vụ đang chạy: 'systemctl status mikrotik-controller'"
  echo "3. Kiểm tra logs: 'journalctl -u mikrotik-controller | tail -n 50'"
  exit 1
fi

# Kiểm tra phản hồi API
if [[ $RESPONSE == *"id"* ]]; then
  echo "===== Thêm thiết bị thành công! ====="
  echo "Thiết bị đã được thêm vào hệ thống giám sát."
  echo "Bạn có thể truy cập dashboard tại http://$SERVER_ADDRESS:$SERVER_PORT để xem thông tin giám sát."
else
  echo "===== Lỗi khi thêm thiết bị ====="
  echo "API trả về lỗi. Vui lòng kiểm tra:"
  echo "1. Thông tin đăng nhập MikroTik chính xác"
  echo "2. Thiết bị MikroTik có thể truy cập từ máy chủ"
  echo "3. API RouterOS đã được bật trên thiết bị MikroTik"
  echo ""
  echo "Phản hồi API:"
  echo "$RESPONSE"
  
  # Thử kiểm tra trạng thái máy chủ
  echo ""
  echo "Kiểm tra trạng thái máy chủ..."
  curl -s -X GET "http://$SERVER_ADDRESS:$SERVER_PORT/api/health" || echo "Không thể kết nối đến máy chủ"
fi