#!/bin/bash

# =================================================================
# MikroTik Monitor - Script cài đặt đầy đủ cho Ubuntu 24.04
# =================================================================
# Script này sẽ:
# - Cài đặt tất cả các dependencies cần thiết (Node.js, Python, PostgreSQL, Nginx)
# - Thiết lập cơ sở dữ liệu PostgreSQL
# - Cấu hình Nginx làm reverse proxy
# - Tạo systemd services để chạy cả Node.js và Streamlit
# - Thiết lập SSL với Let's Encrypt
# - Cấu hình tự động khởi động lại khi reboot
# =================================================================

# Kiểm tra quyền root
if [ "$(id -u)" != "0" ]; then
   echo "Script này cần được chạy với quyền root" 
   echo "Vui lòng chạy lại với sudo: sudo $0"
   exit 1
fi

# Các biến cấu hình
APP_NAME="mikrotik-controller"
APP_DIR="/opt/$APP_NAME"
GIT_REPO="https://github.com/huannv-sys/demo3.0.git"
DOMAIN=""
EMAIL=""
NODE_VERSION="20"
PYTHON_VERSION="3.11"
DB_USER="mikrotikuser"
DB_PASS=""
DB_NAME="mikrotikdb"
NGINX_ENABLED=true
SSL_ENABLED=false
TWILIO_ENABLED=false
SENDGRID_ENABLED=false

# Màu sắc cho output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hiển thị banner
echo -e "${BLUE}"
echo "==============================================================="
echo "             MikroTik Controller - Cài đặt tự động             "
echo "==============================================================="
echo -e "${NC}"

# Hàm hiển thị thông báo
print_status() {
    echo -e "${BLUE}[*] $1${NC}"
}

print_success() {
    echo -e "${GREEN}[✓] $1${NC}"
}

print_error() {
    echo -e "${RED}[✗] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

# Hàm kiểm tra trạng thái command
check_status() {
    if [ $? -eq 0 ]; then
        print_success "$1"
    else
        print_error "$2"
        exit 1
    fi
}

# Hiển thị thông tin và xác nhận
show_info() {
    echo -e "${YELLOW}Thông tin cài đặt:${NC}"
    echo "- Thư mục cài đặt: $APP_DIR"
    echo "- Phiên bản Node.js: $NODE_VERSION"
    echo "- Phiên bản Python: $PYTHON_VERSION"
    echo "- Tên database: $DB_NAME"
    echo "- User database: $DB_USER"
    
    if [ "$NGINX_ENABLED" = true ]; then
        echo "- Cài đặt Nginx: Có"
        
        if [ "$SSL_ENABLED" = true ] && [ ! -z "$DOMAIN" ]; then
            echo "- Cấu hình SSL: Có (cho domain $DOMAIN)"
        else
            echo "- Cấu hình SSL: Không"
        fi
    else
        echo "- Cài đặt Nginx: Không"
    fi
    
    echo ""
    read -p "Tiếp tục cài đặt? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Đã hủy quá trình cài đặt."
        exit 1
    fi
}

# Nhận thông tin từ người dùng
get_user_input() {
    read -p "Tên miền để cấu hình Nginx (để trống nếu không cần): " DOMAIN
    
    if [ ! -z "$DOMAIN" ]; then
        read -p "Email để đăng ký chứng chỉ SSL (để trống nếu không cần SSL): " EMAIL
        
        if [ ! -z "$EMAIL" ]; then
            SSL_ENABLED=true
        fi
    fi
    
    read -p "Mật khẩu cho database PostgreSQL: " DB_PASS
    if [ -z "$DB_PASS" ]; then
        DB_PASS=$(openssl rand -base64 12)
        print_warning "Mật khẩu database được tạo tự động: $DB_PASS (hãy lưu lại)"
    fi
    
    read -p "Bạn có muốn cấu hình thông báo Twilio (SMS)? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        TWILIO_ENABLED=true
        read -p "TWILIO_ACCOUNT_SID: " TWILIO_ACCOUNT_SID
        read -p "TWILIO_AUTH_TOKEN: " TWILIO_AUTH_TOKEN
        read -p "TWILIO_PHONE_NUMBER: " TWILIO_PHONE_NUMBER
    fi
    
    read -p "Bạn có muốn cấu hình thông báo SendGrid (Email)? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        SENDGRID_ENABLED=true
        read -p "SENDGRID_API_KEY: " SENDGRID_API_KEY
    fi
}

# Cập nhật hệ thống
update_system() {
    print_status "Đang cập nhật hệ thống..."
    apt update && apt upgrade -y
    check_status "Cập nhật hệ thống thành công." "Cập nhật hệ thống thất bại."
}

# Cài đặt các gói cần thiết
install_dependencies() {
    print_status "Đang cài đặt các gói phụ thuộc cơ bản..."
    apt install -y curl wget git software-properties-common apt-transport-https ca-certificates gnupg build-essential
    check_status "Cài đặt các gói phụ thuộc cơ bản thành công." "Cài đặt các gói phụ thuộc cơ bản thất bại."
}

# Cài đặt Node.js
install_nodejs() {
    print_status "Đang cài đặt Node.js $NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    check_status "Cài đặt Node.js thành công." "Cài đặt Node.js thất bại."
    
    print_status "Phiên bản Node.js đã cài đặt:"
    node -v
    npm -v
}

# Cài đặt Python
install_python() {
    print_status "Đang cài đặt Python $PYTHON_VERSION..."
    apt install -y python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python3-pip python3-dev
    
    # Tạo symbolic link nếu cần
    if [ ! -e /usr/bin/python3 ]; then
        ln -s /usr/bin/python${PYTHON_VERSION} /usr/bin/python3
    fi
    
    # Cài đặt các gói Python
    print_status "Đang cài đặt các gói Python..."
    pip3 install python-dotenv twilio sendgrid jinja2 routeros-api flask-login flask-wtf pandas plotly requests streamlit trafilatura
    check_status "Cài đặt Python và các gói thành công." "Cài đặt Python thất bại."
    
    print_status "Phiên bản Python đã cài đặt:"
    python3 --version
    pip3 --version
}

# Cài đặt và cấu hình PostgreSQL
install_postgresql() {
    print_status "Đang cài đặt PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    check_status "Cài đặt PostgreSQL thành công." "Cài đặt PostgreSQL thất bại."
    
    print_status "Đang cấu hình database PostgreSQL..."
    
    # Tạo user và database
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH SUPERUSER;"
    
    check_status "Cấu hình PostgreSQL thành công." "Cấu hình PostgreSQL thất bại."
}

# Cài đặt và cấu hình Nginx
install_nginx() {
    if [ "$NGINX_ENABLED" = true ]; then
        print_status "Đang cài đặt Nginx..."
        apt install -y nginx
        check_status "Cài đặt Nginx thành công." "Cài đặt Nginx thất bại."
        
        # Tạo cấu hình Nginx
        print_status "Đang cấu hình Nginx..."
        
        if [ -z "$DOMAIN" ]; then
            # Cấu hình mặc định nếu không có domain
            cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name localhost;

    # Node.js API backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # Streamlit frontend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }
}
EOF
        else
            # Cấu hình với domain
            cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Node.js API backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # Streamlit frontend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }
}
EOF
        fi
        
        # Enable site
        ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
        
        # Kiểm tra cấu hình Nginx
        nginx -t
        check_status "Cấu hình Nginx thành công." "Cấu hình Nginx thất bại."
        
        # Khởi động lại Nginx
        systemctl restart nginx
        check_status "Khởi động Nginx thành công." "Khởi động Nginx thất bại."
    else
        print_warning "Bỏ qua cài đặt Nginx theo yêu cầu."
    fi
}

# Cài đặt và cấu hình Let's Encrypt SSL
setup_ssl() {
    if [ "$SSL_ENABLED" = true ] && [ ! -z "$DOMAIN" ] && [ ! -z "$EMAIL" ]; then
        print_status "Đang cài đặt Certbot cho SSL..."
        apt install -y certbot python3-certbot-nginx
        check_status "Cài đặt Certbot thành công." "Cài đặt Certbot thất bại."
        
        print_status "Đang cấu hình SSL cho domain $DOMAIN..."
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL
        check_status "Cấu hình SSL thành công." "Cấu hình SSL thất bại."
        
        # Cấu hình tự động gia hạn
        systemctl enable certbot.timer
        systemctl start certbot.timer
        check_status "Cấu hình tự động gia hạn SSL thành công." "Cấu hình tự động gia hạn SSL thất bại."
    else
        print_warning "Bỏ qua cấu hình SSL theo yêu cầu hoặc thiếu thông tin."
    fi
}

# Clone và cài đặt ứng dụng
install_app() {
    print_status "Đang cài đặt ứng dụng..."
    
    # Tạo thư mục nếu chưa tồn tại
    if [ ! -d "$APP_DIR" ]; then
        mkdir -p "$APP_DIR"
    fi
    
    # Clone repository
    cd /tmp
    git clone $GIT_REPO $APP_NAME
    check_status "Clone repository thành công." "Clone repository thất bại."
    
    # Sao chép code vào thư mục cài đặt
    cp -r /tmp/$APP_NAME/* $APP_DIR/
    cp -r /tmp/$APP_NAME/.* $APP_DIR/ 2>/dev/null || true
    check_status "Sao chép code thành công." "Sao chép code thất bại."
    
    # Cấu hình file .env
    print_status "Đang cấu hình biến môi trường..."
    cat > $APP_DIR/.env << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# Server Configuration
NODE_ENV=production
PORT=3000

# MikroTik Configuration (cấu hình theo router thực tế)
MIKROTIK_NAME=MikroTik Router
MIKROTIK_ADDRESS=192.168.1.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=

# Use real API instead of mock
USE_REAL_MIKROTIK_API=false
EOF

    # Thêm cấu hình Twilio nếu được bật
    if [ "$TWILIO_ENABLED" = true ]; then
        cat >> $APP_DIR/.env << EOF

# Twilio Credentials
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER
EOF
    fi
    
    # Thêm cấu hình SendGrid nếu được bật
    if [ "$SENDGRID_ENABLED" = true ]; then
        cat >> $APP_DIR/.env << EOF

# SendGrid Credentials
SENDGRID_API_KEY=$SENDGRID_API_KEY
EOF
    fi
    
    check_status "Cấu hình biến môi trường thành công." "Cấu hình biến môi trường thất bại."
    
    # Cấu hình Streamlit
    print_status "Đang cấu hình Streamlit..."
    mkdir -p $APP_DIR/.streamlit
    cat > $APP_DIR/.streamlit/config.toml << EOF
[server]
headless = true
address = "0.0.0.0"
port = 5000
EOF
    check_status "Cấu hình Streamlit thành công." "Cấu hình Streamlit thất bại."
    
    # Cài đặt dependencies của Node.js
    print_status "Đang cài đặt dependencies của Node.js..."
    cd $APP_DIR
    npm install
    check_status "Cài đặt dependencies của Node.js thành công." "Cài đặt dependencies của Node.js thất bại."
    
    # Cập nhật quyền sở hữu
    chown -R $(whoami):$(whoami) $APP_DIR
    chmod -R 755 $APP_DIR
    check_status "Cập nhật quyền sở hữu thành công." "Cập nhật quyền sở hữu thất bại."
}

# Cấu hình systemd services cho Node.js
setup_nodejs_service() {
    print_status "Đang cấu hình systemd service cho Node.js..."
    
    cat > /etc/systemd/system/$APP_NAME-api.service << EOF
[Unit]
Description=MikroTik Controller API
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$APP_NAME-api
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable $APP_NAME-api.service
    systemctl start $APP_NAME-api.service
    check_status "Cấu hình service Node.js thành công." "Cấu hình service Node.js thất bại."
}

# Cấu hình systemd services cho Streamlit
setup_streamlit_service() {
    print_status "Đang cấu hình systemd service cho Streamlit..."
    
    cat > /etc/systemd/system/$APP_NAME-ui.service << EOF
[Unit]
Description=MikroTik Controller UI (Streamlit)
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 -m streamlit run $APP_DIR/app.py --server.port 5000
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$APP_NAME-ui
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable $APP_NAME-ui.service
    systemctl start $APP_NAME-ui.service
    check_status "Cấu hình service Streamlit thành công." "Cấu hình service Streamlit thất bại."
}

# Cấu hình cron job để tự động khởi động lại services khi reboot
setup_cron() {
    print_status "Đang cấu hình cron job cho khởi động tự động..."
    
    (crontab -l 2>/dev/null || echo "") | grep -v "$APP_NAME" > /tmp/crontab
    echo "@reboot systemctl start $APP_NAME-api.service" >> /tmp/crontab
    echo "@reboot systemctl start $APP_NAME-ui.service" >> /tmp/crontab
    crontab /tmp/crontab
    rm /tmp/crontab
    
    check_status "Cấu hình cron job thành công." "Cấu hình cron job thất bại."
}

# Hiển thị thông tin khi hoàn thành
show_completion_info() {
    echo -e "${GREEN}=======================================================${NC}"
    echo -e "${GREEN}      MikroTik Controller đã được cài đặt thành công    ${NC}"
    echo -e "${GREEN}=======================================================${NC}"
    echo ""
    echo "Thông tin cài đặt:"
    echo "- Thư mục ứng dụng: $APP_DIR"
    echo "- Database PostgreSQL:"
    echo "  + Host: localhost"
    echo "  + Port: 5432"
    echo "  + Database: $DB_NAME"
    echo "  + User: $DB_USER"
    echo "  + Password: $DB_PASS"
    
    if [ ! -z "$DOMAIN" ]; then
        echo "- Website URL: http://$DOMAIN"
        
        if [ "$SSL_ENABLED" = true ]; then
            echo "- Website URL (SSL): https://$DOMAIN"
        fi
    else
        DOMAIN_IP=$(curl -s ifconfig.me)
        echo "- Website URL: http://$DOMAIN_IP"
    fi
    
    echo ""
    echo "Các services đã được cấu hình để tự động khởi động khi reboot."
    echo ""
    echo "Để quản lý services:"
    echo "  systemctl status $APP_NAME-api.service  # Kiểm tra trạng thái API"
    echo "  systemctl status $APP_NAME-ui.service   # Kiểm tra trạng thái UI"
    echo ""
    echo "Để xem logs:"
    echo "  journalctl -u $APP_NAME-api.service -f  # Xem logs API"
    echo "  journalctl -u $APP_NAME-ui.service -f   # Xem logs UI"
    echo ""
    echo "Để gỡ cài đặt hoàn toàn, chạy: sudo ./mikrotik-controller-uninstall.sh"
    echo -e "${GREEN}=======================================================${NC}"
}

# Tạo script gỡ cài đặt
create_uninstall_script() {
    print_status "Đang tạo script gỡ cài đặt..."
    
    cat > ./mikrotik-controller-uninstall.sh << EOF
#!/bin/bash

# Script gỡ cài đặt MikroTik Controller
# Cảnh báo: Script này sẽ xóa tất cả dữ liệu liên quan đến ứng dụng

if [ "\$(id -u)" != "0" ]; then
   echo "Script này cần được chạy với quyền root" 
   echo "Vui lòng chạy lại với sudo: sudo \$0"
   exit 1
fi

APP_NAME="$APP_NAME"
APP_DIR="$APP_DIR"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"

echo "======================================================="
echo "           Gỡ cài đặt MikroTik Controller             "
echo "======================================================="
echo
echo "CẢNH BÁO: Quá trình này sẽ xóa tất cả dữ liệu liên quan đến ứng dụng!"
echo
read -p "Bạn có chắc chắn muốn tiếp tục? (y/n): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
    echo "Đã hủy quá trình gỡ cài đặt."
    exit 1
fi

echo "[*] Đang dừng và xóa services..."
systemctl stop \$APP_NAME-api.service 2>/dev/null
systemctl stop \$APP_NAME-ui.service 2>/dev/null
systemctl disable \$APP_NAME-api.service 2>/dev/null
systemctl disable \$APP_NAME-ui.service 2>/dev/null
rm -f /etc/systemd/system/\$APP_NAME-api.service
rm -f /etc/systemd/system/\$APP_NAME-ui.service
systemctl daemon-reload

echo "[*] Đang xóa cấu hình Nginx..."
rm -f /etc/nginx/sites-enabled/\$APP_NAME
rm -f /etc/nginx/sites-available/\$APP_NAME
systemctl reload nginx

echo "[*] Đang xóa database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \$DB_NAME;"
sudo -u postgres psql -c "DROP USER IF EXISTS \$DB_USER;"

echo "[*] Đang xóa thư mục ứng dụng..."
rm -rf \$APP_DIR

echo "[*] Đang xóa cron jobs..."
(crontab -l 2>/dev/null | grep -v "\$APP_NAME") | crontab -

echo "======================================================="
echo "     MikroTik Controller đã được gỡ cài đặt thành công     "
echo "======================================================="
echo
echo "Các thành phần đã được gỡ bỏ:"
echo "- Systemd services"
echo "- Cấu hình Nginx"
echo "- Database PostgreSQL"
echo "- Thư mục ứng dụng"
echo "- Cron jobs"
echo
echo "Lưu ý: Các dependencies như Node.js, Python, Nginx, và PostgreSQL"
echo "vẫn còn trên hệ thống. Nếu bạn muốn gỡ bỏ chúng, hãy chạy:"
echo "sudo apt remove --purge nodejs python3 nginx postgresql postgresql-contrib"
echo "======================================================="
EOF
    
    chmod +x ./mikrotik-controller-uninstall.sh
    check_status "Tạo script gỡ cài đặt thành công." "Tạo script gỡ cài đặt thất bại."
}

# Tạo script fix server node js cho commonjs
fix_nodejs_server() {
    print_status "Đang tạo file server.cjs từ server.js..."
    
    # Copy server.js sang server.cjs
    cp $APP_DIR/server.js $APP_DIR/server.cjs
    
    # Cập nhật service file để sử dụng server.cjs
    sed -i "s|ExecStart=/usr/bin/node $APP_DIR/server.js|ExecStart=/usr/bin/node $APP_DIR/server.cjs|g" /etc/systemd/system/$APP_NAME-api.service
    
    systemctl daemon-reload
    systemctl restart $APP_NAME-api.service
    
    check_status "Chuyển đổi server.js sang định dạng CommonJS thành công." "Chuyển đổi server.js thất bại."
}

# Chức năng chính
main() {
    get_user_input
    show_info
    update_system
    install_dependencies
    install_nodejs
    install_python
    install_postgresql
    install_nginx
    install_app
    setup_nodejs_service
    setup_streamlit_service
    setup_ssl
    setup_cron
    fix_nodejs_server
    create_uninstall_script
    show_completion_info
}

# Bắt đầu quy trình cài đặt
main