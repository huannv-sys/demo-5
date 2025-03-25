# MikroTik Controller

Hệ thống giám sát và quản lý thiết bị MikroTik, cung cấp các công cụ quản lý hiệu quả với khả năng mở rộng. Dự án này được thiết kế để chạy trên máy chủ Ubuntu, cung cấp giao diện web và các công cụ dòng lệnh để giám sát nhiều thiết bị MikroTik cùng lúc.

## Tính năng chính

- Kết nối đến API RouterOS của MikroTik
- Giám sát tài nguyên hệ thống (CPU, RAM, HDD)
- Giám sát và quản lý interfaces
- Hiển thị thông tin thiết bị và trạng thái
- Hỗ trợ nhiều thiết bị MikroTik
- Công cụ giám sát qua dòng lệnh
- API RESTful cho tích hợp với các ứng dụng khác

## Yêu cầu hệ thống

- Ubuntu 20.04 LTS hoặc mới hơn
- Node.js 20.x hoặc mới hơn
- Python 3.8 hoặc mới hơn (cho công cụ giám sát)
- PostgreSQL 12 hoặc mới hơn
- Nginx (cho triển khai)

## Cài đặt nhanh

Sử dụng script cài đặt tự động:

```bash
sudo ./install.sh
```

Script này sẽ:
1. Cài đặt các gói phụ thuộc
2. Cấu hình PostgreSQL
3. Cài đặt Nginx
4. Tạo dịch vụ systemd
5. Khởi động ứng dụng

## Thêm thiết bị MikroTik

Có hai cách để thêm thiết bị:

### Sử dụng giao diện web

Truy cập http://your-server-ip/ và sử dụng giao diện web để thêm thiết bị.

### Sử dụng script

```bash
sudo ./add_mikrotik_device.sh "Tên thiết bị" "Địa chỉ IP" "Cổng API" "Tên đăng nhập" "Mật khẩu" "Mặc định"
```

Ví dụ:
```bash
sudo ./add_mikrotik_device.sh "Router Chính" "192.168.1.1" "8728" "admin" "password" "true"
```

## Giám sát qua dòng lệnh

Sử dụng công cụ giám sát Python:

```bash
python mikrotik_monitor.py
```

Các tùy chọn:
- `--interval SECONDS`: Đặt khoảng thời gian làm mới (mặc định: 5 giây)
- `--router ID`: Chọn router để giám sát (mặc định: 1)

## Kiểm tra kết nối

Để kiểm tra kết nối đến thiết bị MikroTik:

```bash
sudo ./test-mikrotik.sh "Địa chỉ IP" "Tên đăng nhập" "Mật khẩu" "Cổng API"
```

## Quản lý dịch vụ

### Khởi động dịch vụ

```bash
sudo systemctl start mikrotik-controller
```

### Kiểm tra trạng thái

```bash
sudo systemctl status mikrotik-controller
```

### Xem nhật ký

```bash
sudo journalctl -u mikrotik-controller -f
```

## Khắc phục sự cố

Tham khảo [hướng dẫn khắc phục sự cố](troubleshooting.md) để biết thêm chi tiết.

## API Endpoints

- `GET /api/status`: Kiểm tra trạng thái API
- `GET /api/connections`: Danh sách thiết bị
- `POST /api/connections`: Thêm thiết bị mới
- `POST /api/connections/:id/connect`: Kết nối đến thiết bị
- `GET /api/connections/:id/resources`: Thông tin tài nguyên
- `GET /api/connections/:id/interfaces`: Danh sách interfaces

## Đóng góp

Vui lòng tạo issue hoặc pull request trên GitHub repository.

## Giấy phép

Dự án này được phân phối dưới giấy phép MIT.