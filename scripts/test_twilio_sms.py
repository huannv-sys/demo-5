#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script kiểm tra cấu hình Twilio và gửi SMS thử nghiệm

Sử dụng:
  python test_twilio_sms.py --phone +84123456789
"""

import os
import sys
import argparse
import logging
from dotenv import load_dotenv

# Thêm thư mục cha vào PATH để import các module khác
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notifications.sms_service import sms_service

# Tải biến môi trường
load_dotenv()

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_twilio')

def parse_arguments():
    """Phân tích tham số dòng lệnh"""
    parser = argparse.ArgumentParser(description="Kiểm tra cấu hình Twilio và gửi SMS thử nghiệm")
    parser.add_argument('--phone', required=True, help="Số điện thoại nhận SMS thử nghiệm (định dạng +84xxx)")
    return parser.parse_args()

def main():
    """Hàm chính - kiểm tra cấu hình Twilio và gửi SMS thử nghiệm"""
    args = parse_arguments()
    to_phone = args.phone
    
    # Kiểm tra biến môi trường
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    phone_number = os.environ.get('TWILIO_PHONE_NUMBER')
    
    missing = []
    if not account_sid:
        missing.append('TWILIO_ACCOUNT_SID')
    if not auth_token:
        missing.append('TWILIO_AUTH_TOKEN')
    if not phone_number:
        missing.append('TWILIO_PHONE_NUMBER')
    
    if missing:
        logger.error(f"Các biến môi trường sau chưa được cấu hình: {', '.join(missing)}")
        logger.error("Vui lòng thêm vào file .env")
        sys.exit(1)
    
    logger.info(f"Đang gửi SMS thử nghiệm đến {to_phone}...")
    
    # Tạo tin nhắn thử nghiệm
    message = "Đây là tin nhắn thử nghiệm từ MikroTik Monitor. Nếu bạn nhận được tin nhắn này, cấu hình Twilio đã hoạt động!"
    
    result = sms_service.send_sms(to_phone, message)
    
    if result:
        logger.info("Đã gửi SMS thử nghiệm thành công!")
    else:
        logger.error("Gửi SMS thử nghiệm thất bại. Kiểm tra lại cấu hình Twilio API.")

if __name__ == "__main__":
    main()