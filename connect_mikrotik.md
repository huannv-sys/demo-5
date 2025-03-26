# Hướng dẫn kết nối với thiết bị MikroTik thực tế

Để kết nối với thiết bị MikroTik thực tế của bạn, bạn cần cung cấp thông tin đăng nhập chính xác trong file `.env`. Vui lòng cập nhật các thông tin sau:

```
MIKROTIK_NAME=Tên Router của bạn
MIKROTIK_ADDRESS=Địa chỉ IP của Router (ví dụ: 192.168.1.1)
MIKROTIK_PORT=Port API (thường là 8728 cho API không bảo mật, 8729 cho API có SSL)
MIKROTIK_USERNAME=Tên người dùng có quyền quản trị
MIKROTIK_PASSWORD=Mật khẩu của tài khoản
```

## Bảo mật API RouterOS

Mặc định, API RouterOS có thể đã bị vô hiệu hóa trên thiết bị của bạn. Để bật API:

1. Đăng nhập vào RouterOS WinBox hoặc WebFig
2. Đi đến menu IP -> Services
3. Đảm bảo dịch vụ "api" và "api-ssl" được bật
4. Nếu bạn muốn kết nối từ xa, hãy đảm bảo cổng API không bị chặn bởi firewall

## Quyền API

Tài khoản được sử dụng để kết nối cần có đủ quyền để đọc thông tin hệ thống. Tạo một tài khoản riêng cho việc giám sát là thực hành bảo mật tốt.

## Kiểm tra kết nối

Sau khi cập nhật thông tin trong file `.env`, khởi động lại server và thử kết nối:

```
./run_server.sh
```

Hoặc kết nối thông qua UI bằng cách:

1. Truy cập http://localhost:5000
2. Đi đến trang "Cấu hình kết nối"
3. Điền thông tin kết nối và nhấp "Lưu kết nối"

## Khắc phục lỗi kết nối

Nếu không thể kết nối:

1. Kiểm tra IP và thông tin đăng nhập
2. Đảm bảo API RouterOS được bật
3. Kiểm tra firewall cho phép kết nối đến cổng API
4. Kiểm tra tài khoản có đủ quyền để truy cập API

## Giới hạn kết nối

Lưu ý rằng việc giám sát liên tục có thể tạo ra tải trên router. Điều chỉnh tần suất cập nhật nếu bạn gặp vấn đề về hiệu suất.