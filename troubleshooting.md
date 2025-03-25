# Hướng dẫn khắc phục sự cố MikroTik Controller

Tài liệu này cung cấp hướng dẫn để giải quyết các vấn đề thường gặp khi cài đặt và vận hành MikroTik Controller.

## Mục lục

1. [Vấn đề kết nối tới MikroTik](#vấn-đề-kết-nối-tới-mikrotik)
2. [Vấn đề với cơ sở dữ liệu PostgreSQL](#vấn-đề-với-cơ-sở-dữ-liệu-postgresql)
3. [Vấn đề với dịch vụ (Service)](#vấn-đề-với-dịch-vụ-service)
4. [Vấn đề với Nginx](#vấn-đề-với-nginx)
5. [Vấn đề với API](#vấn-đề-với-api)

## Vấn đề kết nối tới MikroTik

### Không thể kết nối đến thiết bị MikroTik

Nếu bạn không thể kết nối đến thiết bị MikroTik, hãy kiểm tra:

1. **Địa chỉ IP và cổng chính xác**: Đảm bảo địa chỉ IP và cổng API (mặc định là 8728) là chính xác.
   ```bash
   ping <địa_chỉ_ip>
   ```

2. **Tên đăng nhập và mật khẩu**: Xác nhận tên đăng nhập và mật khẩu chính xác.

3. **API service được bật**: Đảm bảo API service đã được bật trên thiết bị MikroTik.
   - Truy cập vào WebFig hoặc WinBox
   - Vào IP -> Services
   - Đảm bảo api service được bật (Enabled)

4. **Tường lửa**: Kiểm tra xem tường lửa có chặn kết nối đến cổng API không.
   - Kiểm tra trên MikroTik (IP -> Firewall -> Filter Rules)
   - Kiểm tra tường lửa trên máy chủ:
     ```bash
     sudo ufw status
     ```

5. **Sử dụng công cụ kiểm tra**:
   ```bash
   sudo ./test-mikrotik.sh <địa_chỉ_ip> <tên_đăng_nhập> <mật_khẩu> [cổng_api]
   ```

### Lỗi "connection timed out"

Nếu bạn gặp lỗi "connection timed out":

1. Kiểm tra kết nối mạng giữa máy chủ và thiết bị MikroTik
2. Kiểm tra tường lửa trên MikroTik và máy chủ
3. Kiểm tra xem cổng API có mở không

## Vấn đề với cơ sở dữ liệu PostgreSQL

### Lỗi kết nối đến PostgreSQL

Nếu ứng dụng không thể kết nối đến PostgreSQL:

1. **Kiểm tra dịch vụ PostgreSQL**:
   ```bash
   sudo systemctl status postgresql
   ```

2. **Khởi động lại PostgreSQL nếu cần**:
   ```bash
   sudo systemctl restart postgresql
   ```

3. **Kiểm tra quyền truy cập**:
   ```bash
   sudo -u postgres psql -c "\du"
   ```

4. **Xác nhận cấu hình kết nối**:
   Kiểm tra file .env có chuỗi kết nối đúng không:
   ```
   DATABASE_URL=postgres://mikrouser:4mRQ86Gkv1TuuR8f@localhost:5432/mikrotik_controller
   ```

5. **Cấp quyền superuser cho người dùng nếu cần**:
   ```bash
   sudo -u postgres psql -c "ALTER USER mikrouser WITH SUPERUSER;"
   ```

## Vấn đề với dịch vụ (Service)

### Dịch vụ không khởi động

Nếu dịch vụ mikrotik-controller không khởi động:

1. **Kiểm tra trạng thái**:
   ```bash
   sudo systemctl status mikrotik-controller
   ```

2. **Xem nhật ký (logs)**:
   ```bash
   sudo journalctl -u mikrotik-controller --since today
   ```

3. **Kiểm tra tệp service**:
   ```bash
   sudo cat /etc/systemd/system/mikrotik-controller.service
   ```

4. **Khởi động lại dịch vụ**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart mikrotik-controller
   ```

5. **Kiểm tra quyền của thư mục cài đặt**:
   ```bash
   ls -la /opt/mikrotik-controller
   ```

## Vấn đề với Nginx

### Không thể truy cập qua port 80

Nếu bạn không thể truy cập ứng dụng qua port 80:

1. **Kiểm tra trạng thái Nginx**:
   ```bash
   sudo systemctl status nginx
   ```

2. **Xem nhật ký Nginx**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Kiểm tra cấu hình Nginx**:
   ```bash
   sudo nginx -t
   ```

4. **Khởi động lại Nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

5. **Kiểm tra port**:
   ```bash
   sudo netstat -tulpn | grep 80
   ```

6. **Cấu hình lại Nginx**:
   ```bash
   sudo ./configure-nginx.sh
   ```

## Vấn đề với API

### API không phản hồi

Nếu API không phản hồi:

1. **Kiểm tra xem ứng dụng có đang chạy không**:
   ```bash
   sudo systemctl status mikrotik-controller
   ```

2. **Kiểm tra port API**:
   ```bash
   sudo netstat -tulpn | grep 3000
   ```

3. **Kiểm tra nhật ký (logs)**:
   ```bash
   sudo journalctl -u mikrotik-controller -f
   ```

4. **Kiểm tra kết nối trực tiếp**:
   ```bash
   curl http://localhost:3000/api/status
   ```

5. **Khởi động lại dịch vụ**:
   ```bash
   sudo systemctl restart mikrotik-controller
   ```

### API trả về lỗi

Nếu API trả về lỗi:

1. **Kiểm tra nhật ký để biết thêm chi tiết**:
   ```bash
   sudo journalctl -u mikrotik-controller -f
   ```

2. **Kiểm tra kết nối cơ sở dữ liệu**:
   ```bash
   sudo -u postgres psql -d mikrotik_controller -c "SELECT NOW();"
   ```

3. **Kiểm tra biến môi trường**:
   ```bash
   grep -v '^#' /opt/mikrotik-controller/.env
   ```

---

Nếu bạn vẫn gặp vấn đề sau khi thử các biện pháp trên, vui lòng liên hệ với đội hỗ trợ hoặc tạo issue trên GitHub repository.