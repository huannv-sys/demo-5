# Hướng dẫn sửa lỗi

## Lỗi không kết nối được với API
Nếu bạn nhận được lỗi 'Không thể kết nối đến API', hãy thực hiện các bước sau:

1. Kiểm tra file service có đúng không:
```bash
sudo nano /etc/systemd/system/mikrotik-controller.service
```

2. Đảm bảo dòng ExecStart trỏ đến script run-mikrotik:
```
ExecStart=/usr/bin/run-mikrotik
```

3. Kiểm tra log hệ thống để tìm lỗi:
```bash
sudo journalctl -u mikrotik-controller -n 50
```

4. Xây dựng ứng dụng thủ công:
```bash
cd /đường/dẫn/đến/mikrotik-controller
npm run build
NODE_ENV=production npm run start
```

## Lỗi cơ sở dữ liệu
Nếu gặp lỗi về cơ sở dữ liệu:

1. Kiểm tra connection string trong file .env:
```bash
cat .env | grep DATABASE_URL
```

2. Kiểm tra và đặt lại mật khẩu PostgreSQL:
```bash
sudo -u postgres psql -c "ALTER USER mikrouser WITH PASSWORD 'mật_khẩu';"
```

3. Đảm bảo tạo các bảng cần thiết:
```bash
npm run db:push
```

## Lỗi đăng nhập và thêm thiết bị
Nếu không thể đăng nhập hoặc thêm thiết bị:

1. Tạo người dùng quản trị trong cơ sở dữ liệu:
```sql
INSERT INTO users (username, password) VALUES ('admin', 'admin');
```

2. Đảm bảo API RouterOS đã được bật trên thiết bị MikroTik (qua WebFig hoặc Winbox)

3. Kiểm tra cổng API (mặc định 8728) và đảm bảo tường lửa không chặn kết nối

## Lỗi về script cài đặt
Nếu script cài đặt gặp lỗi:

1. Cập nhật bản mới nhất từ GitHub:
```bash
wget -O install.sh https://raw.githubusercontent.com/huannv-sys/demo2.0/main/install.sh
chmod +x install.sh
```

2. Kiểm tra quyền và chạy với sudo:
```bash
sudo ./install.sh
```

## Liên hệ hỗ trợ
Nếu bạn gặp lỗi không thể tự khắc phục, vui lòng gửi thông tin chi tiết bao gồm:
- Log hệ thống (journalctl -u mikrotik-controller)
- Thông tin hệ thống (uname -a, lsb_release -a)
- Mô tả chi tiết vấn đề