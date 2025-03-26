#!/bin/bash

# Script gỡ bỏ và cài đặt lại dự án MikroTik Monitor
# Tác giả: Replit AI
# Ngày: $(date +%d/%m/%Y)

echo "======================================================"
echo "  SCRIPT GỠ BỎ VÀ CÀI ĐẶT LẠI MIKROTIK MONITOR"
echo "======================================================"

# Lưu trữ thư mục hiện tại
CURRENT_DIR=$(pwd)
BACKUP_DIR="${CURRENT_DIR}_backup_$(date +%Y%m%d_%H%M%S)"

# 1. Sao lưu các file cấu hình và biến môi trường quan trọng
echo "1. Đang sao lưu các file cấu hình và biến môi trường..."
mkdir -p /tmp/mikrotik_backup
if [ -f .env ]; then
  cp .env /tmp/mikrotik_backup/
  echo "   ✓ Sao lưu file .env"
fi

if [ -d config ]; then
  mkdir -p /tmp/mikrotik_backup/config
  cp -r config/* /tmp/mikrotik_backup/config/
  echo "   ✓ Sao lưu thư mục config"
fi

if [ -d templates ]; then
  mkdir -p /tmp/mikrotik_backup/templates
  cp -r templates/* /tmp/mikrotik_backup/templates/
  echo "   ✓ Sao lưu thư mục templates"
fi

# 2. Tạo bản sao lưu toàn bộ thư mục hiện tại (tùy chọn)
echo "2. Bạn có muốn tạo bản sao lưu cho toàn bộ dự án không? (y/n)"
read -r create_backup

if [ "$create_backup" == "y" ] || [ "$create_backup" == "Y" ]; then
  echo "   Đang tạo bản sao lưu tại: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"
  cp -r "$CURRENT_DIR"/* "$BACKUP_DIR"/
  echo "   ✓ Đã tạo bản sao lưu thành công"
else
  echo "   Bỏ qua bước tạo bản sao lưu toàn bộ"
fi

# 3. Xóa tất cả các file và thư mục (trừ script hiện tại và .git nếu có)
echo "3. Đang xóa tất cả các file và thư mục cũ..."
find . -mindepth 1 -not -name "$(basename "$0")" -not -name ".git" -not -path "./.git/*" -exec rm -rf {} \;
echo "   ✓ Đã xóa các file và thư mục cũ"

# 4. Clone repository mới từ GitHub
echo "4. Đang tải mã nguồn mới từ GitHub..."
GIT_REPO="https://github.com/huannv-sys/demo3.0.git"
git clone "$GIT_REPO" temp_repo
if [ $? -ne 0 ]; then
  echo "   ✗ Lỗi khi clone repository. Vui lòng kiểm tra kết nối mạng hoặc URL repository."
  # Khôi phục từ bản sao lưu nếu có
  if [ -d "$BACKUP_DIR" ]; then
    echo "   Đang khôi phục từ bản sao lưu..."
    cp -r "$BACKUP_DIR"/* "$CURRENT_DIR"/
    echo "   ✓ Đã khôi phục từ bản sao lưu"
  fi
  exit 1
fi

echo "   ✓ Đã tải mã nguồn thành công"

# 5. Di chuyển nội dung từ thư mục tạm sang thư mục gốc
echo "5. Đang di chuyển nội dung vào thư mục chính..."
mv temp_repo/* .
mv temp_repo/.* . 2>/dev/null || :  # Di chuyển cả các file ẩn
rm -rf temp_repo
echo "   ✓ Đã di chuyển nội dung thành công"

# 6. Khôi phục các file cấu hình và biến môi trường
echo "6. Đang khôi phục các file cấu hình và biến môi trường..."
if [ -f /tmp/mikrotik_backup/.env ]; then
  cp /tmp/mikrotik_backup/.env .
  echo "   ✓ Đã khôi phục file .env"
else
  echo "   Không tìm thấy file .env trong bản sao lưu, đang tạo file .env mẫu..."
  cat > .env << EOF
# Twilio Credentials
TWILIO_ACCOUNT_SID=\${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=\${TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=\${TWILIO_PHONE_NUMBER}

# SendGrid Credentials
SENDGRID_API_KEY=\${SENDGRID_API_KEY}

# Các biến môi trường khác
NODE_ENV=development
PORT=3000
EOF
  echo "   ✓ Đã tạo file .env mẫu"
fi

if [ -d /tmp/mikrotik_backup/config ]; then
  mkdir -p config
  cp -r /tmp/mikrotik_backup/config/* config/
  echo "   ✓ Đã khôi phục thư mục config"
fi

if [ -d /tmp/mikrotik_backup/templates ]; then
  mkdir -p templates
  cp -r /tmp/mikrotik_backup/templates/* templates/
  echo "   ✓ Đã khôi phục thư mục templates"
fi

# 7. Cập nhật các gói Node.js
echo "7. Đang cài đặt các gói phụ thuộc Node.js..."
npm install
if [ $? -ne 0 ]; then
  echo "   ✗ Lỗi khi cài đặt các gói phụ thuộc Node.js."
  exit 1
fi
echo "   ✓ Đã cài đặt các gói phụ thuộc Node.js thành công"

# 8. Cài đặt các gói Python (nếu có requirements.txt)
if [ -f requirements.txt ]; then
  echo "8. Đang cài đặt các gói phụ thuộc Python..."
  pip install -r requirements.txt
  if [ $? -ne 0 ]; then
    echo "   ✗ Lỗi khi cài đặt các gói phụ thuộc Python."
    exit 1
  fi
  echo "   ✓ Đã cài đặt các gói phụ thuộc Python thành công"
else
  echo "8. Không tìm thấy file requirements.txt, đang cài đặt các gói phụ thuộc Python cơ bản..."
  pip install python-dotenv twilio sendgrid jinja2 routeros-api flask-login flask-wtf pandas plotly requests streamlit trafilatura
  if [ $? -ne 0 ]; then
    echo "   ✗ Lỗi khi cài đặt các gói phụ thuộc Python."
    exit 1
  fi
  echo "   ✓ Đã cài đặt các gói phụ thuộc Python thành công"
fi

# 9. Xóa thư mục backup tạm thời
echo "9. Đang dọn dẹp..."
rm -rf /tmp/mikrotik_backup
echo "   ✓ Đã dọn dẹp bản sao lưu tạm thời"

# 10. Hiển thị thông tin kết thúc
echo "======================================================"
echo "  CÀI ĐẶT LẠI HOÀN TẤT"
echo "======================================================"
echo "Đã cài đặt lại thành công dự án MikroTik Monitor."
echo "Thư mục làm việc hiện tại: $CURRENT_DIR"
if [ "$create_backup" == "y" ] || [ "$create_backup" == "Y" ]; then
  echo "Bản sao lưu được lưu tại: $BACKUP_DIR"
fi
echo ""
echo "Các bước tiếp theo:"
echo "1. Kiểm tra các biến môi trường trong file .env"
echo "2. Chạy 'node server.js' để khởi động máy chủ"
echo "3. Truy cập http://localhost:3000 để xem ứng dụng"
echo "======================================================"