#!/bin/bash

# Script cài đặt tự động cho hệ thống giám sát MikroTik Controller
# Sử dụng cho Ubuntu 24.04
# Phiên bản: 1.1

# Khai báo biến môi trường cho cổng ứng dụng (mặc định 3000)
APP_PORT=3000

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

# Hàm kiểm tra lỗi
check_error() {
  if [ $? -ne 0 ]; then
    print_error "$1"
    echo "Bạn có muốn tiếp tục không? (y/n)"
    read CONTINUE
    if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
      print_error "Cài đặt bị hủy bỏ. Vui lòng thử lại sau."
      exit 1
    fi
  else
    print_success "$2"
  fi
}

# Đặt -e để dừng script nếu có lỗi
set -e

print_header "Bắt đầu cài đặt hệ thống giám sát MikroTik Controller"

# Kiểm tra quyền root
if [ "$(id -u)" != "0" ]; then
   print_error "Script này cần chạy với quyền root (sudo)"
   exit 1
fi

# Kiểm tra phiên bản Ubuntu
OS_VERSION=$(lsb_release -rs)
if [[ "$OS_VERSION" != "24.04" ]]; then
  print_warning "Script này được thiết kế cho Ubuntu 24.04, nhưng bạn đang sử dụng phiên bản $OS_VERSION"
  echo "Bạn có muốn tiếp tục không? (y/n)"
  read CONTINUE
  if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    print_error "Cài đặt bị hủy bỏ"
    exit 1
  fi
fi

print_header "Cập nhật hệ thống"
apt update || { print_error "Không thể cập nhật apt repositories"; exit 1; }
apt upgrade -y || print_warning "Có lỗi khi nâng cấp hệ thống, tiếp tục với cài đặt..."

print_header "Cài đặt các gói phụ thuộc"
apt install -y curl wget git build-essential ufw
check_error "Không thể cài đặt các gói phụ thuộc" "Các gói phụ thuộc đã được cài đặt"

# Cài đặt Node.js 20
print_header "Cài đặt Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || { print_error "Không thể thiết lập NodeSource repository"; exit 1; }
apt install -y nodejs || { print_error "Không thể cài đặt Node.js"; exit 1; }

# Kiểm tra phiên bản Node.js
NODE_VERSION=$(node -v)
print_success "Node.js đã được cài đặt: $NODE_VERSION"

# Cài đặt PostgreSQL
print_header "Cài đặt PostgreSQL"
apt install -y postgresql postgresql-contrib || { print_error "Không thể cài đặt PostgreSQL"; exit 1; }

# Khởi động PostgreSQL
print_header "Khởi động dịch vụ PostgreSQL"
systemctl start postgresql || { print_error "Không thể khởi động PostgreSQL"; exit 1; }
systemctl enable postgresql || print_warning "Không thể thiết lập PostgreSQL khởi động cùng hệ thống"

# Tạo cơ sở dữ liệu và người dùng cho ứng dụng
print_header "Cấu hình cơ sở dữ liệu PostgreSQL"
DB_NAME="mikrotik_controller"
DB_USER="mikrouser"
DB_PASSWORD="$(openssl rand -base64 12)"

# Lưu thông tin cơ sở dữ liệu vào file .env
echo "DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" > .env
echo "USE_REAL_MIKROTIK_API=true" >> .env
echo "SESSION_SECRET=mikrotik-dashboard-secret" >> .env
echo "APP_PORT=$APP_PORT" >> .env

# Tạo user PostgreSQL và database
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || print_warning "Người dùng PostgreSQL đã tồn tại"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || print_warning "Cơ sở dữ liệu đã tồn tại"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || print_warning "Không thể cấp quyền cho người dùng PostgreSQL"
sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;" || print_warning "Không thể đặt quyền superuser cho người dùng PostgreSQL"

print_header "Tải mã nguồn từ GitHub"
if [ -d "mikrotik-controller" ]; then
  echo "Thư mục mikrotik-controller đã tồn tại, đang xóa..."
  rm -rf mikrotik-controller
fi

git clone https://github.com/huannv-sys/demo2.0.git mikrotik-controller || { print_error "Không thể clone repository từ GitHub"; exit 1; }
cd mikrotik-controller || { print_error "Không thể truy cập thư mục mã nguồn"; exit 1; }

# Chuyển .env vào thư mục dự án
mv ../.env .

# Cấu hình cổng ứng dụng trong package.json
print_header "Cấu hình cổng ứng dụng"
# Sử dụng jq nếu có sẵn, nếu không thì dùng sed
if command -v jq &>/dev/null; then
  jq '.scripts.dev = "vite --port '$APP_PORT'"' package.json > package.json.tmp && mv package.json.tmp package.json
else
  # Sử dụng sed nếu không có jq
  sed -i 's/"dev": "vite"/"dev": "vite --port '$APP_PORT'"/g' package.json
fi
print_success "Cổng ứng dụng đã được cấu hình: $APP_PORT"

# Cài đặt các phụ thuộc npm
print_header "Cài đặt các phụ thuộc npm"
npm install || { print_error "Không thể cài đặt các phụ thuộc npm"; exit 1; }

# Khởi tạo cơ sở dữ liệu
print_header "Khởi tạo cơ sở dữ liệu"
npm run db:push || { print_error "Không thể khởi tạo cơ sở dữ liệu"; exit 1; }

# Mở cổng trong firewall
print_header "Cấu hình firewall"
ufw allow $APP_PORT/tcp comment "MikroTik Controller" || print_warning "Không thể mở cổng $APP_PORT trong firewall"
ufw status verbose

# Tạo file systemd để chạy dịch vụ
print_header "Cấu hình dịch vụ systemd"
cat > /etc/systemd/system/mikrotik-controller.service << EOL
[Unit]
Description=MikroTik Controller Monitoring System
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/npm run dev
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=USE_REAL_MIKROTIK_API=true
Environment=SESSION_SECRET=mikrotik-dashboard-secret
Environment=DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd để nhận cấu hình mới
systemctl daemon-reload || { print_error "Không thể tải lại cấu hình systemd"; exit 1; }

# Khởi động dịch vụ
print_header "Khởi động dịch vụ"
systemctl enable mikrotik-controller || { print_error "Không thể bật dịch vụ tự động khởi động"; exit 1; }
systemctl start mikrotik-controller || { print_error "Không thể khởi động dịch vụ"; exit 1; }

# Tạo file script để thêm thiết bị MikroTik
print_header "Tạo script thêm thiết bị MikroTik"
cat > /usr/local/bin/add-mikrotik << EOL
#!/bin/bash

# Script để thêm thiết bị MikroTik vào hệ thống giám sát
# Phiên bản: 1.1

# Đặt màu cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\${BLUE}===== Thêm thiết bị MikroTik vào hệ thống giám sát =====${NC}"

# Kiểm tra tham số command line cho địa chỉ máy chủ
if [ "\$1" != "" ]; then
  SERVER_ADDRESS="\$1"
else
  # Yêu cầu địa chỉ máy chủ từ người dùng
  read -p "Địa chỉ máy chủ (mặc định localhost): " SERVER_ADDRESS
  SERVER_ADDRESS=\${SERVER_ADDRESS:-localhost}
fi

# Kiểm tra tham số cho cổng máy chủ
if [ "\$2" != "" ]; then
  SERVER_PORT="\$2"
else
  # Yêu cầu cổng máy chủ từ người dùng
  read -p "Cổng máy chủ (mặc định $APP_PORT): " SERVER_PORT
  SERVER_PORT=\${SERVER_PORT:-$APP_PORT}
fi

# Kiểm tra kết nối đến máy chủ
echo "Kiểm tra kết nối đến máy chủ \$SERVER_ADDRESS:\$SERVER_PORT..."
if ! curl -s -m 5 "http://\$SERVER_ADDRESS:\$SERVER_PORT/" > /dev/null; then
  echo -e "\${YELLOW}⚠️ Không thể kết nối đến máy chủ. Đảm bảo rằng:${NC}"
  echo "  1. Dịch vụ đã được khởi động (systemctl status mikrotik-controller)"
  echo "  2. Cổng \$SERVER_PORT đã được mở trong firewall"
  echo "  3. Địa chỉ máy chủ chính xác"
  echo ""
  read -p "Bạn có muốn tiếp tục không? (y/n): " CONTINUE
  if [[ "\$CONTINUE" != "y" && "\$CONTINUE" != "Y" ]]; then
    echo "Hủy thao tác."
    exit 1
  fi
fi

# Yêu cầu thông tin thiết bị từ người dùng
read -p "Tên thiết bị: " DEVICE_NAME
read -p "Địa chỉ IP thiết bị MikroTik: " DEVICE_IP
read -p "Cổng API thiết bị MikroTik (mặc định 8728): " DEVICE_PORT
DEVICE_PORT=\${DEVICE_PORT:-8728}
read -p "Tên đăng nhập thiết bị MikroTik: " DEVICE_USERNAME
read -s -p "Mật khẩu thiết bị MikroTik: " DEVICE_PASSWORD
echo ""
read -p "Đặt làm thiết bị mặc định? (y/n): " SET_DEFAULT
DEFAULT_FLAG="false"
if [[ "\$SET_DEFAULT" == "y" || "\$SET_DEFAULT" == "Y" ]]; then
  DEFAULT_FLAG="true"
fi

# Tạo JSON payload
JSON_PAYLOAD="{\\\"name\\\":\\\"$DEVICE_NAME\\\",\\\"address\\\":\\\"$DEVICE_IP\\\",\\\"port\\\":\\$DEVICE_PORT,\\\"username\\\":\\\"$DEVICE_USERNAME\\\",\\\"password\\\":\\\"$DEVICE_PASSWORD\\\",\\\"isDefault\\\":\\$DEFAULT_FLAG}"

echo -e "\${BLUE}===== Đang thêm thiết bị vào hệ thống =====${NC}"
echo "Thông tin thiết bị:"
echo "- Tên: \$DEVICE_NAME"
echo "- Địa chỉ IP: \$DEVICE_IP"
echo "- Cổng: \$DEVICE_PORT"
echo "- Người dùng: \$DEVICE_USERNAME"
echo "- Mặc định: \$DEFAULT_FLAG"

# Gửi yêu cầu đến API
API_URL="http://\$SERVER_ADDRESS:\$SERVER_PORT/api/connections"

echo "Đang gửi yêu cầu đến \$API_URL"
echo "Đang thực hiện..."

# Thêm thông tin debug và timeout
RESPONSE=\$(curl -s -m 10 -X POST -H "Content-Type: application/json" -d "\$JSON_PAYLOAD" "\$API_URL" 2>&1)
CURL_EXIT_CODE=\$?

# Kiểm tra kết quả curl
if [ \$CURL_EXIT_CODE -ne 0 ]; then
  echo -e "\${RED}===== Lỗi kết nối =====${NC}"
  echo "Không thể kết nối đến API. Mã lỗi: \$CURL_EXIT_CODE"
  echo "Chi tiết:"
  
  if [ \$CURL_EXIT_CODE -eq 7 ]; then
    echo "  - Không thể kết nối đến máy chủ. Kiểm tra địa chỉ và cổng."
  elif [ \$CURL_EXIT_CODE -eq 28 ]; then
    echo "  - Kết nối bị timeout. Máy chủ có thể quá tải hoặc không phản hồi."
  fi
  
  echo "Thông tin debug:"
  echo "\$RESPONSE"
  echo ""
  echo "Vui lòng thực hiện các bước sau để kiểm tra:"
  echo "1. Chạy 'curl -v http://\$SERVER_ADDRESS:\$SERVER_PORT/' để kiểm tra kết nối chung"
  echo "2. Đảm bảo rằng dịch vụ đang chạy: 'systemctl status mikrotik-controller'"
  echo "3. Kiểm tra logs: 'journalctl -u mikrotik-controller | tail -n 50'"
  exit 1
fi

# Kiểm tra phản hồi API
if [[ \$RESPONSE == *"id"* ]]; then
  echo -e "\${GREEN}===== Thêm thiết bị thành công! =====${NC}"
  echo "Thiết bị đã được thêm vào hệ thống giám sát."
  echo "Bạn có thể truy cập dashboard tại http://\$SERVER_ADDRESS:\$SERVER_PORT để xem thông tin giám sát."
else
  echo -e "\${RED}===== Lỗi khi thêm thiết bị =====${NC}"
  echo "API trả về lỗi. Vui lòng kiểm tra:"
  echo "1. Thông tin đăng nhập MikroTik chính xác"
  echo "2. Thiết bị MikroTik có thể truy cập từ máy chủ"
  echo "3. API RouterOS đã được bật trên thiết bị MikroTik"
  echo ""
  echo "Phản hồi API:"
  echo "\$RESPONSE"
  
  # Thử kiểm tra trạng thái máy chủ
  echo ""
  echo "Kiểm tra trạng thái máy chủ..."
  curl -s -X GET "http://\$SERVER_ADDRESS:\$SERVER_PORT/api/health" || echo "Không thể kết nối đến máy chủ"
fi
EOL

# Cấp quyền thực thi cho script
chmod +x /usr/local/bin/add-mikrotik
ln -sf /usr/local/bin/add-mikrotik /usr/bin/add-mikrotik
print_success "Script thêm thiết bị đã được tạo: /usr/bin/add-mikrotik"

# Tạo file script để khởi động lại dịch vụ
print_header "Tạo script khởi động lại dịch vụ"
cat > /usr/local/bin/restart-mikrotik-controller << EOL
#!/bin/bash
systemctl restart mikrotik-controller
echo "Dịch vụ MikroTik Controller đã được khởi động lại"
systemctl status mikrotik-controller
EOL

chmod +x /usr/local/bin/restart-mikrotik-controller
ln -sf /usr/local/bin/restart-mikrotik-controller /usr/bin/restart-mikrotik-controller
print_success "Script khởi động lại dịch vụ đã được tạo: /usr/bin/restart-mikrotik-controller"

# Kiểm tra trạng thái dịch vụ
sleep 5
SERVICE_STATUS=$(systemctl is-active mikrotik-controller)
if [ "$SERVICE_STATUS" = "active" ]; then
  print_success "Dịch vụ MikroTik Controller đang chạy"
else
  print_warning "Dịch vụ MikroTik Controller không khởi động được. Đang thử khởi động lại..."
  systemctl restart mikrotik-controller
  sleep 5
  SERVICE_STATUS=$(systemctl is-active mikrotik-controller)
  if [ "$SERVICE_STATUS" = "active" ]; then
    print_success "Dịch vụ MikroTik Controller đã được khởi động thành công"
  else
    print_error "Không thể khởi động dịch vụ MikroTik Controller. Vui lòng kiểm tra logs"
    journalctl -u mikrotik-controller | tail -n 30
  fi
fi

# Hiển thị thông tin cài đặt
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo ""
print_header "Cài đặt hoàn tất!"
echo -e "${GREEN}Hệ thống giám sát MikroTik Controller đã được cài đặt thành công.${NC}"
echo ""
echo -e "${BLUE}Thông tin quan trọng:${NC}"
echo "- Truy cập ứng dụng tại: ${GREEN}http://$IP_ADDRESS:$APP_PORT${NC}"
echo "- Thông tin cơ sở dữ liệu:"
echo "  - Tên DB: $DB_NAME"
echo "  - Người dùng: $DB_USER"
echo "  - Mật khẩu: $DB_PASSWORD"
echo ""
echo "Các lệnh hữu ích:"
echo "- Thêm thiết bị MikroTik: ${GREEN}add-mikrotik${NC}"
echo "- Khởi động lại dịch vụ: ${GREEN}restart-mikrotik-controller${NC}"
echo "- Kiểm tra trạng thái dịch vụ: ${GREEN}systemctl status mikrotik-controller${NC}"
echo "- Xem log: ${GREEN}journalctl -u mikrotik-controller -f${NC}"
echo ""
echo -e "${GREEN}Chúc mừng! Bạn đã cài đặt thành công hệ thống giám sát MikroTik Controller.${NC}"