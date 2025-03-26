#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module cung cấp hàm tiện ích để gửi SMS qua Twilio API
"""

import os
from dotenv import load_dotenv
from twilio.rest import Client

# Tải biến môi trường từ file .env
load_dotenv()

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER")


def send_twilio_message(to_phone_number: str, message: str) -> None:
    """
    Gửi tin nhắn SMS qua Twilio
    
    Args:
        to_phone_number (str): Số điện thoại người nhận (định dạng +84xxx)
        message (str): Nội dung tin nhắn
        
    Returns:
        None: Hàm không trả về giá trị
        
    Raises:
        Exception: Nếu gửi tin nhắn thất bại
    """
    # Kiểm tra các biến môi trường cần thiết
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        missing = []
        if not TWILIO_ACCOUNT_SID:
            missing.append('TWILIO_ACCOUNT_SID')
        if not TWILIO_AUTH_TOKEN:
            missing.append('TWILIO_AUTH_TOKEN')
        if not TWILIO_PHONE_NUMBER:
            missing.append('TWILIO_PHONE_NUMBER')
        
        raise ValueError(f"Thiếu các biến môi trường Twilio: {', '.join(missing)}")
    
    # Khởi tạo client Twilio
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    # Gửi tin nhắn SMS
    try:
        message_result = client.messages.create(
            body=message, 
            from_=TWILIO_PHONE_NUMBER, 
            to=to_phone_number
        )
        
        print(f"Đã gửi tin nhắn SMS thành công. SID: {message_result.sid}")
        return message_result.sid
    except Exception as e:
        print(f"Gửi tin nhắn SMS thất bại: {str(e)}")
        raise