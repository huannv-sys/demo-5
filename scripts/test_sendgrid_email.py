#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script kiểm tra cấu hình SendGrid và gửi email thử nghiệm

Sử dụng:
  python test_sendgrid_email.py --email user@example.com
"""

import os
import sys
import argparse
import logging
from dotenv import load_dotenv

# Thêm thư mục cha vào PATH để import các module khác
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notifications.email_service import email_service

# Tải biến môi trường
load_dotenv()

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_sendgrid')

def parse_arguments():
    """Phân tích tham số dòng lệnh"""
    parser = argparse.ArgumentParser(description="Kiểm tra cấu hình SendGrid và gửi email thử nghiệm")
    parser.add_argument('--email', required=True, help="Địa chỉ email nhận thông báo thử nghiệm")
    return parser.parse_args()

def main():
    """Hàm chính - kiểm tra cấu hình SendGrid và gửi email thử nghiệm"""
    args = parse_arguments()
    to_email = args.email
    
    # Kiểm tra biến môi trường
    api_key = os.environ.get('SENDGRID_API_KEY')
    if not api_key:
        logger.error("SENDGRID_API_KEY chưa được cấu hình. Vui lòng thêm vào file .env")
        sys.exit(1)
    
    logger.info(f"Đang gửi email thử nghiệm đến {to_email}...")
    
    # Tạo và gửi email
    context = {
        'device_name': 'MikroTik Router Thử Nghiệm',
        'alert_type': 'Kiểm tra kết nối',
        'alert_message': 'Đây là email thử nghiệm từ MikroTik Monitor.',
        'details': {
            'version': '1.0.0',
            'environment': 'Development',
            'test_time': 'Bây giờ'
        },
        'timestamp': 'Thời gian hiện tại'
    }
    
    result = email_service.send_email(
        to_email=to_email,
        subject="[TEST] MikroTik Monitor - Email Thử Nghiệm",
        template_name="alert_email.html",
        context=context
    )
    
    if result:
        logger.info("Đã gửi email thử nghiệm thành công!")
    else:
        logger.error("Gửi email thử nghiệm thất bại. Kiểm tra lại cấu hình SendGrid API.")

if __name__ == "__main__":
    main()