#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module quản lý thông báo tổng hợp cho hệ thống giám sát MikroTik
"""

import os
import sys
import logging
import json
from datetime import datetime

# Import các dịch vụ thông báo
from notifications.email_service import email_service
from notifications.sms_service import sms_service

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('notification_service')

# Đường dẫn đến file cấu hình thông báo
CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config', 'notification_config.json')

class NotificationService:
    """
    Dịch vụ quản lý thông báo tổng hợp cho hệ thống giám sát MikroTik.
    Hỗ trợ nhiều phương thức thông báo: Email, SMS.
    """
    
    def __init__(self):
        """Khởi tạo dịch vụ thông báo"""
        self.config = self._load_config()
        
        # Tạo thư mục config nếu chưa tồn tại
        config_dir = os.path.dirname(CONFIG_FILE)
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)
            logger.info(f"Đã tạo thư mục cấu hình: {config_dir}")
            
        # Tạo file cấu hình mẫu nếu chưa tồn tại
        if not os.path.exists(CONFIG_FILE):
            self._create_default_config()
    
    def _load_config(self):
        """Đọc cấu hình từ file JSON"""
        if not os.path.exists(CONFIG_FILE):
            return self._get_default_config()
            
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info("Đã tải cấu hình thông báo")
            return config
        except Exception as e:
            logger.error(f"Lỗi khi đọc file cấu hình: {e}")
            return self._get_default_config()
    
    def _save_config(self):
        """Lưu cấu hình vào file JSON"""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            logger.info("Đã lưu cấu hình thông báo")
            return True
        except Exception as e:
            logger.error(f"Lỗi khi lưu file cấu hình: {e}")
            return False
    
    def _get_default_config(self):
        """Trả về cấu hình mặc định"""
        return {
            "enabled": True,
            "channels": {
                "email": {
                    "enabled": True,
                    "recipients": []
                },
                "sms": {
                    "enabled": True,
                    "recipients": []
                }
            },
            "alert_types": {
                "connection_lost": {
                    "enabled": True,
                    "channels": ["email", "sms"],
                    "message": "Mất kết nối đến thiết bị",
                    "priority": "high"
                },
                "high_cpu": {
                    "enabled": True,
                    "channels": ["email"],
                    "threshold": 80,
                    "message": "Tải CPU cao",
                    "priority": "medium"
                },
                "high_memory": {
                    "enabled": True,
                    "channels": ["email"],
                    "threshold": 80,
                    "message": "Sử dụng bộ nhớ cao",
                    "priority": "medium"
                },
                "interface_down": {
                    "enabled": True,
                    "channels": ["email", "sms"],
                    "message": "Interface ngừng hoạt động",
                    "priority": "high"
                },
                "custom": {
                    "enabled": True,
                    "channels": ["email"],
                    "priority": "medium"
                }
            }
        }
    
    def _create_default_config(self):
        """Tạo file cấu hình mặc định"""
        self.config = self._get_default_config()
        self._save_config()
        logger.info("Đã tạo file cấu hình mặc định")
    
    def add_email_recipient(self, email):
        """Thêm địa chỉ email vào danh sách nhận thông báo"""
        if email not in self.config["channels"]["email"]["recipients"]:
            self.config["channels"]["email"]["recipients"].append(email)
            self._save_config()
            logger.info(f"Đã thêm địa chỉ email {email} vào danh sách nhận thông báo")
            return True
        return False
    
    def remove_email_recipient(self, email):
        """Xóa địa chỉ email khỏi danh sách nhận thông báo"""
        if email in self.config["channels"]["email"]["recipients"]:
            self.config["channels"]["email"]["recipients"].remove(email)
            self._save_config()
            logger.info(f"Đã xóa địa chỉ email {email} khỏi danh sách nhận thông báo")
            return True
        return False
    
    def add_sms_recipient(self, phone):
        """Thêm số điện thoại vào danh sách nhận thông báo"""
        if phone not in self.config["channels"]["sms"]["recipients"]:
            self.config["channels"]["sms"]["recipients"].append(phone)
            self._save_config()
            logger.info(f"Đã thêm số điện thoại {phone} vào danh sách nhận thông báo")
            return True
        return False
    
    def remove_sms_recipient(self, phone):
        """Xóa số điện thoại khỏi danh sách nhận thông báo"""
        if phone in self.config["channels"]["sms"]["recipients"]:
            self.config["channels"]["sms"]["recipients"].remove(phone)
            self._save_config()
            logger.info(f"Đã xóa số điện thoại {phone} khỏi danh sách nhận thông báo")
            return True
        return False
    
    def enable_notification(self, enabled=True):
        """Bật/tắt thông báo"""
        self.config["enabled"] = enabled
        self._save_config()
        logger.info(f"Đã {'bật' if enabled else 'tắt'} thông báo")
    
    def enable_email(self, enabled=True):
        """Bật/tắt thông báo email"""
        self.config["channels"]["email"]["enabled"] = enabled
        self._save_config()
        logger.info(f"Đã {'bật' if enabled else 'tắt'} thông báo email")
    
    def enable_sms(self, enabled=True):
        """Bật/tắt thông báo SMS"""
        self.config["channels"]["sms"]["enabled"] = enabled
        self._save_config()
        logger.info(f"Đã {'bật' if enabled else 'tắt'} thông báo SMS")
    
    def send_alert(self, device_name, alert_type, message=None, details=None):
        """
        Gửi thông báo cảnh báo theo cấu hình
        
        Args:
            device_name (str): Tên thiết bị MikroTik
            alert_type (str): Loại cảnh báo (phải tồn tại trong cấu hình)
            message (str, optional): Nội dung thông báo tùy chỉnh. Nếu không cung cấp, sẽ sử dụng mặc định
            details (dict, optional): Chi tiết bổ sung về cảnh báo
            
        Returns:
            dict: Kết quả gửi thông báo cho từng kênh
        """
        # Kiểm tra xem thông báo có được bật không
        if not self.config["enabled"]:
            logger.info("Thông báo đã bị tắt, bỏ qua gửi cảnh báo")
            return {"status": "disabled"}
        
        # Kiểm tra loại cảnh báo có được hỗ trợ không
        if alert_type not in self.config["alert_types"]:
            logger.error(f"Loại cảnh báo không được hỗ trợ: {alert_type}")
            return {"status": "error", "message": f"Unsupported alert type: {alert_type}"}
        
        # Kiểm tra xem loại cảnh báo có được bật không
        alert_config = self.config["alert_types"][alert_type]
        if not alert_config["enabled"]:
            logger.info(f"Cảnh báo loại {alert_type} đã bị tắt, bỏ qua gửi")
            return {"status": "alert_type_disabled"}
        
        # Lấy nội dung thông báo
        alert_message = message if message else alert_config.get("message", f"Cảnh báo: {alert_type}")
        
        # Kết quả gửi thông báo
        results = {"status": "sent", "channels": {}}
        
        # Gửi thông báo qua các kênh được cấu hình
        for channel in alert_config["channels"]:
            if channel == "email" and self.config["channels"]["email"]["enabled"]:
                email_results = self._send_email_alerts(device_name, alert_type, alert_message, details)
                results["channels"]["email"] = email_results
            
            if channel == "sms" and self.config["channels"]["sms"]["enabled"]:
                sms_results = self._send_sms_alerts(device_name, alert_type, alert_message)
                results["channels"]["sms"] = sms_results
        
        return results
    
    def _send_email_alerts(self, device_name, alert_type, alert_message, details=None):
        """Gửi cảnh báo qua email cho tất cả người nhận"""
        recipients = self.config["channels"]["email"]["recipients"]
        if not recipients:
            logger.warning("Không có người nhận email được cấu hình")
            return {"status": "no_recipients"}
        
        results = {"recipients": {}}
        for email in recipients:
            success = email_service.send_alert_email(email, device_name, alert_type, alert_message, details)
            results["recipients"][email] = "success" if success else "failed"
        
        return results
    
    def _send_sms_alerts(self, device_name, alert_type, alert_message):
        """Gửi cảnh báo qua SMS cho tất cả người nhận"""
        recipients = self.config["channels"]["sms"]["recipients"]
        if not recipients:
            logger.warning("Không có người nhận SMS được cấu hình")
            return {"status": "no_recipients"}
        
        results = {"recipients": {}}
        for phone in recipients:
            success = sms_service.send_alert_sms(phone, device_name, alert_type, alert_message)
            results["recipients"][phone] = "success" if success else "failed"
        
        return results
    
    def get_config(self):
        """Trả về cấu hình hiện tại"""
        return self.config
    
    def update_config(self, new_config):
        """Cập nhật toàn bộ cấu hình"""
        self.config = new_config
        return self._save_config()


# Singleton instance
notification_service = NotificationService()

# Hàm tiện ích để sử dụng trong các module khác
def send_alert(device_name, alert_type, message=None, details=None):
    """Hàm tiện ích để gửi cảnh báo"""
    return notification_service.send_alert(device_name, alert_type, message, details)