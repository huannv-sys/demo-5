#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module gửi thông báo qua SMS sử dụng Twilio API
"""

import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Tải các biến môi trường
load_dotenv()

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('sms_service')

class SMSService:
    """Dịch vụ gửi SMS thông qua Twilio API"""
    
    def __init__(self):
        """Khởi tạo dịch vụ SMS"""
        self.account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        self.auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
        self.phone_number = os.environ.get('TWILIO_PHONE_NUMBER')
        
        if not all([self.account_sid, self.auth_token, self.phone_number]):
            missing = []
            if not self.account_sid:
                missing.append('TWILIO_ACCOUNT_SID')
            if not self.auth_token:
                missing.append('TWILIO_AUTH_TOKEN')
            if not self.phone_number:
                missing.append('TWILIO_PHONE_NUMBER')
            logger.error(f"Thiếu các biến môi trường Twilio: {', '.join(missing)}")
    
    def send_sms(self, to_phone, message):
        """
        Gửi tin nhắn SMS
        
        Args:
            to_phone (str): Số điện thoại người nhận (định dạng +84xxxxx)
            message (str): Nội dung tin nhắn
            
        Returns:
            bool: True nếu gửi thành công, False nếu thất bại
        """
        if not all([self.account_sid, self.auth_token, self.phone_number]):
            logger.error("Không thể gửi SMS: Thiếu thông tin cấu hình Twilio")
            return False
        
        try:
            # Khởi tạo Twilio client
            client = Client(self.account_sid, self.auth_token)
            
            # Gửi tin nhắn
            message_result = client.messages.create(
                body=message,
                from_=self.phone_number,
                to=to_phone
            )
            
            logger.info(f"Đã gửi SMS thành công đến {to_phone} (SID: {message_result.sid})")
            return True
            
        except TwilioRestException as e:
            logger.error(f"Lỗi Twilio khi gửi SMS: {e}")
            return False
        except Exception as e:
            logger.error(f"Lỗi không xác định khi gửi SMS: {e}")
            return False
    
    def send_alert_sms(self, to_phone, device_name, alert_type, alert_message):
        """
        Gửi SMS cảnh báo
        
        Args:
            to_phone (str): Số điện thoại người nhận
            device_name (str): Tên thiết bị MikroTik
            alert_type (str): Loại cảnh báo
            alert_message (str): Nội dung cảnh báo
            
        Returns:
            bool: True nếu gửi thành công, False nếu thất bại
        """
        timestamp = datetime.now().strftime('%H:%M:%S %d/%m/%Y')
        
        # Tạo nội dung tin nhắn
        message = f"[CẢNH BÁO] {device_name}\n"
        message += f"Loại: {alert_type}\n"
        message += f"Thông báo: {alert_message}\n"
        message += f"Thời gian: {timestamp}"
        
        return self.send_sms(to_phone, message)


# Singleton instance
sms_service = SMSService()

# Hàm tiện ích để sử dụng trong các module khác
def send_alert(to_phone, device_name, alert_type, alert_message):
    """Hàm tiện ích để gửi SMS cảnh báo"""
    return sms_service.send_alert_sms(to_phone, device_name, alert_type, alert_message)