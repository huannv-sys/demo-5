#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module gửi thông báo qua email sử dụng SendGrid API
"""

import os
import sys
import logging
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from jinja2 import Environment, FileSystemLoader

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('email_service')

# Thư mục chứa templates email
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')

class EmailService:
    """Dịch vụ gửi email sử dụng SendGrid API"""
    
    def __init__(self):
        """Khởi tạo dịch vụ email"""
        self.api_key = os.environ.get('SENDGRID_API_KEY')
        if not self.api_key:
            logger.error("SENDGRID_API_KEY không được cấu hình trong biến môi trường")
        
        # Kiểm tra thư mục template
        if not os.path.exists(TEMPLATE_DIR):
            os.makedirs(TEMPLATE_DIR)
            logger.info(f"Đã tạo thư mục templates: {TEMPLATE_DIR}")
        
        # Khởi tạo Jinja2 environment
        self.jinja_env = Environment(
            loader=FileSystemLoader(TEMPLATE_DIR),
            autoescape=True
        )
    
    def send_email(self, to_email, subject, template_name, context=None, from_email="mikrotik-monitor@example.com"):
        """
        Gửi email sử dụng template
        
        Args:
            to_email (str): Email người nhận
            subject (str): Tiêu đề email
            template_name (str): Tên file template (phải kết thúc bằng .html và nằm trong thư mục templates)
            context (dict): Dữ liệu để render template
            from_email (str): Email người gửi
            
        Returns:
            bool: True nếu gửi thành công, False nếu thất bại
        """
        if not self.api_key:
            logger.error("Không thể gửi email: Thiếu SENDGRID_API_KEY")
            return False

        if context is None:
            context = {}

        try:
            # Render template
            template = self.jinja_env.get_template(template_name)
            html_content = template.render(**context)
            
            # Tạo message
            message = Mail(
                from_email=Email(from_email),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            # Gửi email
            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)
            
            # Kiểm tra kết quả
            if response.status_code >= 200 and response.status_code < 300:
                logger.info(f"Đã gửi email thành công đến {to_email}")
                return True
            else:
                logger.error(f"Gửi email thất bại: {response.status_code} - {response.body}")
                return False
                
        except Exception as e:
            logger.error(f"Lỗi khi gửi email: {e}")
            return False
    
    def send_alert_email(self, to_email, device_name, alert_type, alert_message, details=None):
        """
        Gửi email cảnh báo
        
        Args:
            to_email (str): Email người nhận
            device_name (str): Tên thiết bị MikroTik
            alert_type (str): Loại cảnh báo
            alert_message (str): Nội dung cảnh báo
            details (dict): Chi tiết bổ sung về cảnh báo
            
        Returns:
            bool: True nếu gửi thành công, False nếu thất bại
        """
        subject = f"[CẢNH BÁO] {alert_type} - {device_name}"
        
        if details is None:
            details = {}
            
        context = {
            'device_name': device_name,
            'alert_type': alert_type,
            'alert_message': alert_message,
            'details': details,
            'timestamp': 'lúc ' + datetime.now().strftime('%H:%M:%S ngày %d/%m/%Y')
        }
        
        return self.send_email(to_email, subject, "alert_email.html", context)


# Singleton instance
email_service = EmailService()

# Hàm tiện ích để sử dụng trong các module khác
def send_alert(to_email, device_name, alert_type, alert_message, details=None):
    """Hàm tiện ích để gửi email cảnh báo"""
    return email_service.send_alert_email(to_email, device_name, alert_type, alert_message, details)