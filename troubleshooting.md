# Hướng dẫn khắc phục sự cố

Tài liệu này cung cấp giải pháp cho các vấn đề thường gặp khi sử dụng MikroTik Controller.

## Mục lục
1. [Lỗi kết nối đến thiết bị MikroTik](#lỗi-kết-nối-đến-thiết-bị-mikrotik)
2. [Lỗi cơ sở dữ liệu](#lỗi-cơ-sở-dữ-liệu)
3. [Lỗi khởi động dịch vụ](#lỗi-khởi-động-dịch-vụ)
4. [Lỗi giao diện web](#lỗi-giao-diện-web)
5. [Lỗi cấu hình Nginx](#lỗi-cấu-hình-nginx)
6. [Công cụ khắc phục sự cố](#công-cụ-khắc-phục-sự-cố)

## Lỗi kết nối đến thiết bị MikroTik

### Không thể kết nối đến API RouterOS

**Triệu chứng:** Không thể kết nối, nhận thông báo lỗi "Connection timed out" hoặc "Connection refused".

**Giải pháp:**

1. Kiểm tra địa chỉ IP:
   ```bash
   ping <địa_chỉ_ip_của_router>
   ```

2. Kiểm tra cổng API:
   ```bash
   telnet <địa_chỉ_ip_của_router> <cổng_API>
   ```
   Cổng mặc định thường là 8728 cho API không bảo mật và 8729 cho API bảo mật (SSL).

3. Kiểm tra tường lửa trên router, đảm bảo cổng API đã được mở:
   - Đăng nhập vào router qua Winbox hoặc WebFig
   - Đi đến IP -> Firewall -> Filter Rules
   - Kiểm tra các quy tắc cho cổng API (8728/8729)

4. Kiểm tra tường lửa trên máy chủ:
   ```bash
   sudo ufw status
   # Nếu cần, mở cổng
   sudo ufw allow <cổng_API>/tcp
   ```

### Lỗi xác thực API

**Triệu chứng:** Kết nối đến router nhưng nhận lỗi "Invalid username or password".

**Giải pháp:**

1. Kiểm tra đúng tên người dùng và mật khẩu
2. Đảm bảo tài khoản có quyền truy cập API:
   - Đăng nhập vào router
   - Đi đến System -> Users
   - Kiểm tra quyền (Policy) của tài khoản, đảm bảo có "api" và "read"

### Lỗi SSL/TLS

**Triệu chứng:** Lỗi liên quan đến SSL khi kết nối đến API bảo mật.

**Giải pháp:**
1. Kiểm tra cấu hình API:
   ```bash
   # Sử dụng cổng không SSL trước
   ./test-mikrotik.sh "<địa_chỉ_ip>" "<tên_đăng_nhập>" "<mật_khẩu>" "8728"
   ```

2. Nếu bạn cần sử dụng API bảo mật, hãy đảm bảo chứng chỉ SSL của router hợp lệ

## Lỗi cơ sở dữ liệu

### Không thể kết nối đến PostgreSQL

**Triệu chứng:** Lỗi "Connection refused" khi cố gắng kết nối đến PostgreSQL.

**Giải pháp:**

1. Kiểm tra dịch vụ PostgreSQL:
   ```bash
   sudo systemctl status postgresql
   # Nếu không chạy
   sudo systemctl start postgresql
   ```

2. Kiểm tra URL kết nối trong file .env:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/mikrotik_controller
   ```

3. Kiểm tra quyền truy cập:
   ```bash
   sudo -u postgres psql -c "ALTER USER username WITH PASSWORD 'password';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mikrotik_controller TO username;"
   ```

### Lỗi cấu trúc cơ sở dữ liệu

**Triệu chứng:** Lỗi "relation does not exist" khi truy vấn.

**Giải pháp:**

Tạo lại bảng nếu cần:

```bash
# Kết nối đến cơ sở dữ liệu
sudo -u postgres psql mikrotik_controller

# Tạo bảng router_connections nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS router_connections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 8728,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_connected TIMESTAMP
);

# Tạo bảng log_entries nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS log_entries (
  id SERIAL PRIMARY KEY,
  router_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  level VARCHAR(50) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (router_id) REFERENCES router_connections(id) ON DELETE CASCADE
);
```

## Lỗi khởi động dịch vụ

### Dịch vụ không thể khởi động

**Triệu chứng:** Lỗi khi chạy `systemctl start mikrotik-controller`.

**Giải pháp:**

1. Kiểm tra cấu hình dịch vụ:
   ```bash
   sudo systemctl status mikrotik-controller
   sudo journalctl -u mikrotik-controller
   ```

2. Kiểm tra quyền:
   ```bash
   sudo chown -R <user>:<group> /opt/mikrotik-controller
   sudo chmod +x /opt/mikrotik-controller/*.sh
   ```

3. Kiểm tra môi trường Node.js:
   ```bash
   node -v  # Đảm bảo phiên bản >= 20.x
   npm -v
   ```

4. Thử chạy ứng dụng trực tiếp:
   ```bash
   cd /opt/mikrotik-controller
   node server.mjs
   ```

### Lỗi kết nối cổng

**Triệu chứng:** Lỗi "Port already in use".

**Giải pháp:**

1. Kiểm tra cổng đang sử dụng:
   ```bash
   sudo lsof -i :3000
   ```

2. Kết thúc tiến trình nếu cần:
   ```bash
   sudo kill <PID>
   ```

3. Thay đổi cổng trong file .env:
   ```
   PORT=3001
   ```

## Lỗi giao diện web

### Không thể truy cập giao diện web

**Triệu chứng:** Lỗi "Connection refused" hoặc không thể tải trang.

**Giải pháp:**

1. Kiểm tra ứng dụng đang chạy:
   ```bash
   sudo systemctl status mikrotik-controller
   # Hoặc kiểm tra bằng PID
   cat /opt/mikrotik-controller/server.pid
   ps -p $(cat /opt/mikrotik-controller/server.pid)
   ```

2. Kiểm tra tường lửa:
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp  # Hoặc cổng bạn đã cấu hình
   ```

3. Kiểm tra khả năng kết nối từ bên ngoài:
   ```bash
   # Đảm bảo server đang lắng nghe trên tất cả các giao diện (0.0.0.0)
   sudo netstat -tulpn | grep node
   ```

### Giao diện web hiển thị lỗi

**Triệu chứng:** Trang web tải nhưng hiển thị lỗi JavaScript.

**Giải pháp:**

1. Kiểm tra log:
   ```bash
   tail -f /opt/mikrotik-controller/server.log
   ```

2. Làm mới bộ nhớ cache trình duyệt:
   - Nhấn Ctrl+F5 trong trình duyệt
   - Hoặc xóa bộ nhớ cache trong cài đặt trình duyệt

## Lỗi cấu hình Nginx

### Nginx không thể kết nối đến ứng dụng

**Triệu chứng:** Lỗi 502 Bad Gateway khi truy cập qua Nginx.

**Giải pháp:**

1. Kiểm tra cấu hình Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/mikrotik-controller
   ```

2. Đảm bảo cấu hình proxy_pass chính xác:
   ```
   location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

3. Kiểm tra cú pháp và khởi động lại Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Công cụ khắc phục sự cố

### Công cụ kiểm tra kết nối

Để kiểm tra kết nối đến thiết bị MikroTik:

```bash
./test-mikrotik.sh "địa_chỉ_ip" "tên_đăng_nhập" "mật_khẩu" "cổng"
```

### Kiểm tra cơ sở dữ liệu

Kiểm tra lược đồ cơ sở dữ liệu:

```bash
sudo -u postgres psql mikrotik_controller -c "\d"
```

Kiểm tra thiết bị trong cơ sở dữ liệu:

```bash
sudo -u postgres psql mikrotik_controller -c "SELECT * FROM router_connections;"
```

### Khởi động lại hoàn toàn

Để khởi động lại toàn bộ dịch vụ:

```bash
sudo systemctl restart postgresql
sudo systemctl restart nginx
sudo systemctl restart mikrotik-controller
```

### Xem nhật ký thời gian thực

```bash
tail -f /opt/mikrotik-controller/server.log
```

hoặc

```bash
sudo journalctl -u mikrotik-controller -f
```