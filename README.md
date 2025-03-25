# Hệ thống giám sát MikroTik Controller

Đây là hệ thống giám sát dành cho các thiết bị MikroTik RouterOS, cho phép bạn kết nối, giám sát và quản lý nhiều thiết bị MikroTik từ một giao diện quản lý thống nhất.

## Tính năng chính

- Giám sát tài nguyên hệ thống (CPU, RAM, bộ nhớ)
- Theo dõi các giao diện mạng và băng thông
- Giám sát mạng không dây và các thiết bị kết nối
- Quản lý các quy tắc tường lửa
- Xem logs hệ thống
- Quản lý nhiều thiết bị MikroTik
- Giao diện người dùng hiện đại, dễ sử dụng

## Yêu cầu hệ thống

- Ubuntu 24.04 LTS
- Node.js 20.x
- PostgreSQL 16.x

## Cài đặt tự động

Cách đơn giản nhất để cài đặt hệ thống là sử dụng script cài đặt tự động.

1. Tải script cài đặt:
   ```bash
   wget https://raw.githubusercontent.com/huannv-sys/demo2.0/main/install.sh
   ```

2. Cấp quyền thực thi cho script:
   ```bash
   chmod +x install.sh
   ```

3. Chạy script với quyền root:
   ```bash
   sudo ./install.sh
   ```

Script sẽ tự động:
- Cài đặt Node.js, PostgreSQL và các phụ thuộc cần thiết
- Tạo cơ sở dữ liệu và người dùng PostgreSQL
- Tải mã nguồn từ GitHub
- Cấu hình và khởi động dịch vụ
- Thiết lập các lệnh hữu ích để quản lý hệ thống

## Thêm thiết bị MikroTik

Sau khi cài đặt, bạn có thể thêm thiết bị MikroTik bằng lệnh:

```bash
add-mikrotik
```

Hoặc chỉ định địa chỉ và cổng của server:

```bash
add-mikrotik 192.168.1.100 3000
```

Script sẽ hướng dẫn bạn nhập thông tin thiết bị MikroTik cần giám sát:
- Tên thiết bị
- Địa chỉ IP
- Cổng API (mặc định 8728)
- Tên đăng nhập
- Mật khẩu
- Có đặt làm thiết bị mặc định không

## Truy cập hệ thống

Sau khi cài đặt, bạn có thể truy cập hệ thống qua trình duyệt web:

```
http://<địa_chỉ_IP_máy_chủ>:3000
```

## Quản lý dịch vụ

Bạn có thể quản lý dịch vụ MikroTik Controller bằng các lệnh:

```bash
# Khởi động lại dịch vụ một cách nhanh chóng
restart-mikrotik-controller

# Hoặc sử dụng các lệnh systemd tiêu chuẩn:
sudo systemctl status mikrotik-controller
sudo systemctl start mikrotik-controller
sudo systemctl stop mikrotik-controller
sudo systemctl restart mikrotik-controller
```

## Xem logs

Để xem logs của hệ thống trong thời gian thực:

```bash
sudo journalctl -u mikrotik-controller -f
```

Hoặc xem logs gần đây:

```bash
sudo journalctl -u mikrotik-controller -n 100
```

## Xử lý sự cố

Nếu bạn gặp vấn đề khi cài đặt hoặc sử dụng hệ thống, vui lòng thực hiện các bước sau:

### 1. Kiểm tra trạng thái dịch vụ

```bash
sudo systemctl status mikrotik-controller
```

### 2. Kiểm tra logs

```bash
sudo journalctl -u mikrotik-controller -n 100
```

### 3. Kiểm tra kết nối đến cơ sở dữ liệu

```bash
sudo -u postgres psql -c "\l" | grep mikrotik
```

### 4. Kiểm tra cổng đã được mở chưa

```bash
sudo ufw status | grep 3000
```

### 5. Khởi động lại dịch vụ

```bash
restart-mikrotik-controller
```

### 6. Kiểm tra kết nối đến thiết bị MikroTik

Đảm bảo rằng:
- API RouterOS đã được bật trên thiết bị MikroTik
- Tên đăng nhập và mật khẩu chính xác
- Không có tường lửa chặn kết nối

## Thông tin bổ sung

- Dự án này dựa trên kho lưu trữ [demo2.0](https://github.com/huannv-sys/demo2.0)
- Sử dụng [routeros-client](https://www.npmjs.com/package/routeros-client) để giao tiếp với thiết bị MikroTik
- Giao diện xây dựng bằng React, Tailwind CSS và shadcn/ui
- Backend sử dụng Express và Drizzle ORM

## Tùy chỉnh

### Thay đổi cổng mặc định

Nếu muốn sử dụng cổng khác thay vì 3000, hãy chỉnh sửa file:

```bash
sudo nano /etc/systemd/system/mikrotik-controller.service
```

Sau đó khởi động lại dịch vụ:

```bash
sudo systemctl daemon-reload
sudo systemctl restart mikrotik-controller
```

### Nâng cấp hệ thống

Để nâng cấp khi có phiên bản mới:

```bash
cd /đường/dẫn/đến/mikrotik-controller
git pull
npm install
npm run db:push
sudo systemctl restart mikrotik-controller
```