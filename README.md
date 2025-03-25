# MikroTik Controller - Hệ thống giám sát Router MikroTik

Hệ thống giám sát và quản lý thiết bị MikroTik được phát triển trên máy chủ Ubuntu, cung cấp các công cụ quản lý và theo dõi hiệu quả với khả năng mở rộng và xử lý lỗi.

## Tính năng chính

- **Giám sát trực tiếp**: Kết nối trực tiếp đến API của RouterOS
- **Quản lý nhiều thiết bị**: Thêm, sửa và xóa nhiều thiết bị MikroTik
- **Dashboard trực quan**: Xem thông tin tổng quan hệ thống
- **Giám sát tài nguyên**: CPU, RAM, dung lượng đĩa và thời gian hoạt động
- **Quản lý interface**: Xem và quản lý tất cả giao diện mạng
- **Mạng không dây**: Giám sát mạng WiFi và các client kết nối
- **Firewall**: Quản lý các quy tắc tường lửa
- **Logs**: Xem nhật ký hệ thống

## Cài đặt

### Yêu cầu hệ thống

- Ubuntu 24.04 (hoặc cao hơn)
- Node.js 20+
- PostgreSQL

### Cài đặt tự động

Cách đơn giản nhất để cài đặt là sử dụng script cài đặt tự động:

```bash
wget -O install.sh https://raw.githubusercontent.com/huannv-sys/demo2.0/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

Script sẽ tự động:
1. Cài đặt các phụ thuộc cần thiết
2. Cấu hình PostgreSQL
3. Tải mã nguồn từ GitHub
4. Cấu hình và khởi động dịch vụ

### Thêm thiết bị MikroTik

Sau khi cài đặt, bạn có thể thêm thiết bị MikroTik bằng lệnh:

```bash
add-mikrotik
```

hoặc với tham số:

```bash
add-mikrotik <địa_chỉ_máy_chủ> <cổng>
```

### Khởi động lại dịch vụ

Nếu cần khởi động lại dịch vụ:

```bash
restart-mikrotik-controller
```

## Khắc phục sự cố

### Kết nối đến thiết bị MikroTik

1. Đảm bảo API RouterOS đã được bật trên thiết bị MikroTik
2. Kiểm tra cổng API (mặc định 8728)
3. Kiểm tra quyền người dùng MikroTik có đủ để truy cập API

### Lỗi dịch vụ

Kiểm tra logs hệ thống:

```bash
journalctl -u mikrotik-controller -f
```

## Thông tin thêm

- Source code: [https://github.com/huannv-sys/demo2.0](https://github.com/huannv-sys/demo2.0)