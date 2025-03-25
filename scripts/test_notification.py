#!/usr/bin/env python3
"""
Script gửi thông báo thử nghiệm

Sử dụng:
  python test_notification.py --email user@example.com
  python test_notification.py --sms +84123456789
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Thêm thư mục gốc vào sys.path để import các module
sys.path.insert(0, str(Path(__file__).parent.parent))

from notifications.email_service import send_alert as send_email_alert
from notifications.sms_service import send_alert as send_sms_alert

def parse_arguments():
    """Phân tích tham số dòng lệnh"""
    parser = argparse.ArgumentParser(description='Gửi thông báo thử nghiệm')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--email', type=str, help='Địa chỉ email để gửi thông báo thử nghiệm')
    group.add_argument('--sms', type=str, help='Số điện thoại để gửi thông báo thử nghiệm')
    return parser.parse_args()

def main():
    """Hàm chính - gửi thông báo thử nghiệm"""
    args = parse_arguments()

    if args.email:
        print(f"Đang gửi email thử nghiệm đến {args.email}...")
        result = send_email_alert(args.email, "MikroTik Test", "test_alert", "Đây là email thử nghiệm từ MikroTik Monitor")
        if result:
            print(f"Đã gửi email thử nghiệm thành công đến {args.email}")
        else:
            print(f"Không thể gửi email thử nghiệm đến {args.email}")
            sys.exit(1)
    
    elif args.sms:
        print(f"Đang gửi SMS thử nghiệm đến {args.sms}...")
        result = send_sms_alert(args.sms, "MikroTik Test", "test_alert", "Đây là SMS thử nghiệm từ MikroTik Monitor")
        if result:
            print(f"Đã gửi SMS thử nghiệm thành công đến {args.sms}")
        else:
            print(f"Không thể gửi SMS thử nghiệm đến {args.sms}")
            sys.exit(1)

if __name__ == "__main__":
    main()