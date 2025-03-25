#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module giám sát và phát hiện sự cố trên thiết bị MikroTik
"""

import os
import sys
import time
import json
import logging
import atexit
from datetime import datetime, timedelta
import threading
import requests

# Thêm thư mục gốc vào đường dẫn để import các module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notifications import send_alert

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs', 'alert_monitor.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('alert_monitor')

# Đường dẫn đến file cấu hình thông báo
CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config', 'alert_monitor_config.json')

class AlertMonitor:
    """
    Giám sát các thông số của thiết bị MikroTik và phát cảnh báo khi phát hiện sự cố
    """
    
    def __init__(self):
        """Khởi tạo monitor"""
        self.config = self._load_config()
        self.active = False
        self.stop_event = threading.Event()
        self.last_alerts = {}  # Lưu thời gian gửi cảnh báo gần nhất
        self.router_status = {}  # Lưu trạng thái các router
        
        # Tạo thư mục logs nếu chưa tồn tại
        logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)
        
        # Đảm bảo mọi tiến trình đang chạy được dừng đúng cách khi thoát
        atexit.register(self.stop)
    
    def _load_config(self):
        """Đọc cấu hình từ file JSON"""
        if not os.path.exists(CONFIG_FILE):
            return self._get_default_config()
            
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info("Đã tải cấu hình giám sát")
            return config
        except Exception as e:
            logger.error(f"Lỗi khi đọc file cấu hình: {e}")
            return self._get_default_config()
    
    def _save_config(self):
        """Lưu cấu hình vào file JSON"""
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
            logger.info("Đã lưu cấu hình giám sát")
            return True
        except Exception as e:
            logger.error(f"Lỗi khi lưu file cấu hình: {e}")
            return False
    
    def _get_default_config(self):
        """Trả về cấu hình mặc định"""
        return {
            "enabled": True,
            "check_interval": 60,  # Kiểm tra mỗi 60 giây
            "connection_timeout": 10,  # Timeout kết nối 10 giây
            "alert_cooldown": 1800,  # Thời gian chờ giữa các cảnh báo (giây)
            "alerts": {
                "connection_lost": {
                    "enabled": True,
                    "retries": 3,  # Số lần thử lại trước khi cảnh báo
                    "cooldown": 1800  # Thời gian chờ giữa các cảnh báo (giây)
                },
                "high_cpu": {
                    "enabled": True,
                    "threshold": 80,  # Ngưỡng phần trăm
                    "duration": 300,  # Thời gian (giây) vượt ngưỡng liên tục
                    "cooldown": 3600
                },
                "high_memory": {
                    "enabled": True,
                    "threshold": 80,
                    "duration": 300,
                    "cooldown": 3600
                },
                "interface_down": {
                    "enabled": True,
                    "excluded_interfaces": ["lo"],  # Danh sách interface bỏ qua
                    "cooldown": 1800
                },
                "high_bandwidth": {
                    "enabled": True,
                    "threshold": 80,  # Ngưỡng % băng thông tối đa
                    "duration": 300,
                    "cooldown": 3600
                },
                "firewall_change": {
                    "enabled": True,
                    "cooldown": 1800
                },
                "dhcp_server_down": {
                    "enabled": True,
                    "cooldown": 1800
                },
                "vpn_connection_failed": {
                    "enabled": True,
                    "cooldown": 1800
                },
                "wireless_interference": {
                    "enabled": True,
                    "signal_threshold": -80,  # dBm, tín hiệu yếu
                    "cooldown": 3600
                }
            }
        }
    
    def _create_default_config(self):
        """Tạo file cấu hình mặc định"""
        self.config = self._get_default_config()
        self._save_config()
        logger.info("Đã tạo file cấu hình mặc định")
    
    def start(self):
        """Bắt đầu giám sát"""
        if self.active:
            logger.warning("Giám sát đã đang chạy")
            return
        
        self.active = True
        self.stop_event.clear()
        
        # Chạy trong thread riêng
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()
        
        logger.info("Đã bắt đầu giám sát MikroTik")
    
    def stop(self):
        """Dừng giám sát"""
        if not self.active:
            return
        
        self.active = False
        self.stop_event.set()
        
        if hasattr(self, 'monitor_thread') and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)
        
        logger.info("Đã dừng giám sát MikroTik")
    
    def _monitor_loop(self):
        """Vòng lặp giám sát chính"""
        logger.info("Vòng lặp giám sát đã bắt đầu")
        
        while self.active and not self.stop_event.is_set():
            try:
                # Lấy danh sách các router đã cấu hình
                routers = self._get_router_connections()
                
                for router in routers:
                    router_id = router.get('id')
                    if not router_id:
                        continue
                    
                    # Kiểm tra kết nối
                    self._check_router_connection(router)
                    
                    # Nếu router đã kết nối, kiểm tra các thông số
                    if self._is_router_connected(router_id):
                        self._check_router_resources(router_id)
                        self._check_router_interfaces(router_id)
                        
                        # Kiểm tra các thông số nâng cao
                        self._check_bandwidth_usage(router_id)
                        self._check_firewall_changes(router_id)
                        self._check_dhcp_servers(router_id)
                        self._check_vpn_connections(router_id)
                        self._check_wireless_networks(router_id)
                
                # Chờ đến lần kiểm tra tiếp theo
                self.stop_event.wait(self.config["check_interval"])
                
            except Exception as e:
                logger.error(f"Lỗi trong vòng lặp giám sát: {e}", exc_info=True)
                # Chờ 30 giây trước khi thử lại nếu có lỗi
                self.stop_event.wait(30)
    
    def _get_router_connections(self):
        """Lấy danh sách các router đã cấu hình từ API"""
        try:
            # Gọi API để lấy danh sách router
            url = "http://localhost:3000/api/connections"
            response = requests.get(url, timeout=self.config["connection_timeout"])
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Lỗi khi lấy danh sách router: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Lỗi khi lấy danh sách router: {e}")
            return []
    
    def _check_router_connection(self, router):
        """Kiểm tra kết nối đến router"""
        router_id = router.get('id')
        router_name = router.get('name', f'Router #{router_id}')
        
        try:
            # Gọi API để kiểm tra trạng thái kết nối
            url = f"http://localhost:3000/api/connections/{router_id}/status"
            response = requests.get(url, timeout=self.config["connection_timeout"])
            
            if response.status_code == 200:
                data = response.json()
                connected = data.get('connected', False)
                
                # Cập nhật trạng thái router
                if router_id not in self.router_status:
                    self.router_status[router_id] = {
                        'connected': connected,
                        'connection_check_count': 0,
                        'last_status_change': datetime.now(),
                        'resources': {},
                        'interfaces': {}
                    }
                else:
                    # Nếu trạng thái thay đổi, cập nhật thời gian
                    if self.router_status[router_id]['connected'] != connected:
                        self.router_status[router_id]['last_status_change'] = datetime.now()
                        
                        # Gửi cảnh báo khi mất kết nối
                        if not connected and self.config["alerts"]["connection_lost"]["enabled"]:
                            # Tăng bộ đếm kiểm tra
                            self.router_status[router_id]['connection_check_count'] += 1
                            
                            # Kiểm tra số lần thử lại
                            if self.router_status[router_id]['connection_check_count'] >= self.config["alerts"]["connection_lost"]["retries"]:
                                # Kiểm tra cooldown
                                alert_key = f"connection_lost_{router_id}"
                                if self._can_send_alert(alert_key, self.config["alerts"]["connection_lost"]["cooldown"]):
                                    logger.warning(f"Phát hiện mất kết nối đến {router_name}")
                                    self._send_connection_lost_alert(router_id, router_name)
                        
                        # Reset bộ đếm nếu kết nối lại
                        if connected:
                            self.router_status[router_id]['connection_check_count'] = 0
                    
                    # Cập nhật trạng thái
                    self.router_status[router_id]['connected'] = connected
            else:
                logger.error(f"Lỗi khi kiểm tra kết nối router {router_name}: {response.status_code}")
        except Exception as e:
            logger.error(f"Lỗi khi kiểm tra kết nối router {router_name}: {e}")
    
    def _is_router_connected(self, router_id):
        """Kiểm tra xem router có đang kết nối không"""
        if router_id not in self.router_status:
            return False
        return self.router_status[router_id]['connected']
    
    def _check_router_resources(self, router_id):
        """Kiểm tra tài nguyên của router (CPU, Memory)"""
        try:
            # Gọi API để lấy thông tin tài nguyên
            url = f"http://localhost:3000/api/routers/{router_id}/resources"
            response = requests.get(url, timeout=self.config["connection_timeout"])
            
            if response.status_code == 200:
                resources = response.json()
                
                # Lấy tên router
                router_name = self._get_router_name(router_id)
                
                # Kiểm tra CPU
                self._check_cpu_usage(router_id, router_name, resources)
                
                # Kiểm tra Memory
                self._check_memory_usage(router_id, router_name, resources)
                
                # Cập nhật thông tin tài nguyên
                self.router_status[router_id]['resources'] = resources
            else:
                logger.error(f"Lỗi khi lấy thông tin tài nguyên router #{router_id}: {response.status_code}")
        except Exception as e:
            logger.error(f"Lỗi khi kiểm tra tài nguyên router #{router_id}: {e}")
    
    def _check_cpu_usage(self, router_id, router_name, resources):
        """Kiểm tra mức sử dụng CPU"""
        if not self.config["alerts"]["high_cpu"]["enabled"]:
            return
        
        try:
            cpu_load = resources.get('cpuLoad', 0)
            
            # Chuyển đổi thành số nếu cần
            if isinstance(cpu_load, str):
                cpu_load = cpu_load.rstrip('%')
                try:
                    cpu_load = float(cpu_load)
                except ValueError:
                    cpu_load = 0
            
            # Kiểm tra ngưỡng
            threshold = self.config["alerts"]["high_cpu"]["threshold"]
            
            if cpu_load >= threshold:
                # Kiểm tra thời gian vượt ngưỡng
                if 'high_cpu_since' not in self.router_status[router_id]:
                    self.router_status[router_id]['high_cpu_since'] = datetime.now()
                
                # Tính thời gian vượt ngưỡng
                duration = (datetime.now() - self.router_status[router_id]['high_cpu_since']).total_seconds()
                
                # Kiểm tra nếu đã vượt ngưỡng đủ lâu
                if duration >= self.config["alerts"]["high_cpu"]["duration"]:
                    # Kiểm tra cooldown
                    alert_key = f"high_cpu_{router_id}"
                    if self._can_send_alert(alert_key, self.config["alerts"]["high_cpu"]["cooldown"]):
                        logger.warning(f"Phát hiện CPU cao trên {router_name}: {cpu_load}%")
                        self._send_high_cpu_alert(router_id, router_name, cpu_load)
            else:
                # Reset thời gian vượt ngưỡng
                if 'high_cpu_since' in self.router_status[router_id]:
                    del self.router_status[router_id]['high_cpu_since']
        except Exception as e:
            logger.error(f"Lỗi khi kiểm tra CPU router #{router_id}: {e}")
    
    def _check_memory_usage(self, router_id, router_name, resources):
        """Kiểm tra mức sử dụng Memory"""
        if not self.config["alerts"]["high_memory"]["enabled"]:
            return
        
        try:
            # Tính phần trăm sử dụng bộ nhớ
            memory_used = resources.get('memoryUsed', 0)
            memory_total = resources.get('memoryTotal', 0)
            
            if memory_total == 0:
                return
            
            memory_percent = (memory_used / memory_total) * 100
            
            # Kiểm tra ngưỡng
            threshold = self.config["alerts"]["high_memory"]["threshold"]
            
            if memory_percent >= threshold:
                # Kiểm tra thời gian vượt ngưỡng
                if 'high_memory_since' not in self.router_status[router_id]:
                    self.router_status[router_id]['high_memory_since'] = datetime.now()
                
                # Tính thời gian vượt ngưỡng
                duration = (datetime.now() - self.router_status[router_id]['high_memory_since']).total_seconds()
                
                # Kiểm tra nếu đã vượt ngưỡng đủ lâu
                if duration >= self.config["alerts"]["high_memory"]["duration"]:
                    # Kiểm tra cooldown
                    alert_key = f"high_memory_{router_id}"
                    if self._can_send_alert(alert_key, self.config["alerts"]["high_memory"]["cooldown"]):
                        logger.warning(f"Phát hiện Memory cao trên {router_name}: {memory_percent:.1f}%")
                        self._send_high_memory_alert(router_id, router_name, memory_percent)
            else:
                # Reset thời gian vượt ngưỡng
                if 'high_memory_since' in self.router_status[router_id]:
                    del self.router_status[router_id]['high_memory_since']
        except Exception as e:
            logger.error(f"Lỗi khi kiểm tra Memory router #{router_id}: {e}")
    
    def _check_router_interfaces(self, router_id):
        """Kiểm tra trạng thái các interface"""
        if not self.config["alerts"]["interface_down"]["enabled"]:
            return
        
        try:
            # Gọi API để lấy thông tin interface
            url = f"http://localhost:3000/api/routers/{router_id}/interfaces"
            response = requests.get(url, timeout=self.config["connection_timeout"])
            
            if response.status_code == 200:
                interfaces = response.json()
                router_name = self._get_router_name(router_id)
                
                # Lưu trạng thái cũ nếu chưa có
                if 'interfaces' not in self.router_status[router_id]:
                    self.router_status[router_id]['interfaces'] = {}
                
                # Kiểm tra từng interface
                for interface in interfaces:
                    name = interface.get('name')
                    
                    # Bỏ qua các interface được loại trừ
                    if name in self.config["alerts"]["interface_down"]["excluded_interfaces"]:
                        continue
                    
                    running = interface.get('running', False)
                    disabled = interface.get('disabled', False)
                    
                    # Chỉ quan tâm đến interface đang bật
                    if disabled:
                        continue
                    
                    # Lưu trạng thái cũ
                    if name not in self.router_status[router_id]['interfaces']:
                        self.router_status[router_id]['interfaces'][name] = {
                            'running': running,
                            'last_change': datetime.now()
                        }
                    
                    # Kiểm tra nếu trạng thái thay đổi
                    if self.router_status[router_id]['interfaces'][name]['running'] != running:
                        self.router_status[router_id]['interfaces'][name]['running'] = running
                        self.router_status[router_id]['interfaces'][name]['last_change'] = datetime.now()
                        
                        # Gửi cảnh báo nếu interface ngừng hoạt động
                        if not running:
                            # Kiểm tra cooldown
                            alert_key = f"interface_down_{router_id}_{name}"
                            if self._can_send_alert(alert_key, self.config["alerts"]["interface_down"]["cooldown"]):
                                logger.warning(f"Phát hiện interface {name} ngừng hoạt động trên {router_name}")
                                self._send_interface_down_alert(router_id, router_name, name, interface)
            else:
                logger.error(f"Lỗi khi lấy thông tin interface router #{router_id}: {response.status_code}")
        except Exception as e:
            logger.error(f"Lỗi khi kiểm tra interface router #{router_id}: {e}")
    
    def _get_router_name(self, router_id):
        """Lấy tên của router từ ID"""
        try:
            # Gọi API để lấy thông tin router
            url = f"http://localhost:3000/api/connections/{router_id}"
            response = requests.get(url, timeout=self.config["connection_timeout"])
            
            if response.status_code == 200:
                router = response.json()
                return router.get('name', f'Router #{router_id}')
            else:
                return f"Router #{router_id}"
        except Exception:
            return f"Router #{router_id}"
    
    def _can_send_alert(self, alert_key, cooldown_seconds):
        """Kiểm tra xem đã đủ thời gian để gửi lại cảnh báo chưa"""
        now = datetime.now()
        
        if alert_key not in self.last_alerts:
            self.last_alerts[alert_key] = now
            return True
        
        last_time = self.last_alerts[alert_key]
        elapsed = (now - last_time).total_seconds()
        
        if elapsed >= cooldown_seconds:
            self.last_alerts[alert_key] = now
            return True
        
        return False
    
    def _send_connection_lost_alert(self, router_id, router_name):
        """Gửi cảnh báo mất kết nối"""
        details = {
            "router_id": router_id,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "connection_lost", None, details)
    
    def _send_high_cpu_alert(self, router_id, router_name, cpu_load):
        """Gửi cảnh báo CPU cao"""
        details = {
            "router_id": router_id,
            "cpu_load": f"{cpu_load:.1f}%",
            "threshold": f"{self.config['alerts']['high_cpu']['threshold']}%",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "high_cpu", None, details)
    
    def _send_high_memory_alert(self, router_id, router_name, memory_percent):
        """Gửi cảnh báo Memory cao"""
        details = {
            "router_id": router_id,
            "memory_usage": f"{memory_percent:.1f}%",
            "threshold": f"{self.config['alerts']['high_memory']['threshold']}%",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "high_memory", None, details)
    
    def _send_interface_down_alert(self, router_id, router_name, interface_name, interface_data):
        """Gửi cảnh báo interface ngừng hoạt động"""
        details = {
            "router_id": router_id,
            "interface": interface_name,
            "type": interface_data.get('type', 'unknown'),
            "mac_address": interface_data.get('macAddress', 'N/A'),
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "interface_down", None, details)
    
    def _send_high_bandwidth_alert(self, router_id, router_name, interface_name, bandwidth_usage, max_bandwidth):
        """Gửi cảnh báo băng thông cao"""
        usage_percent = (bandwidth_usage / max_bandwidth) * 100 if max_bandwidth > 0 else 0
        details = {
            "router_id": router_id,
            "interface": interface_name,
            "bandwidth_usage": f"{bandwidth_usage / 1000000:.1f} Mbps", # Convert to Mbps
            "maximum_bandwidth": f"{max_bandwidth / 1000000:.1f} Mbps",
            "usage_percent": f"{usage_percent:.1f}%",
            "threshold": f"{self.config['alerts']['high_bandwidth']['threshold']}%",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "high_bandwidth", None, details)
    
    def _send_firewall_change_alert(self, router_id, router_name, changes):
        """Gửi cảnh báo khi phát hiện thay đổi cấu hình firewall"""
        details = {
            "router_id": router_id,
            "changes": changes,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "firewall_change", None, details)
    
    def _send_dhcp_server_down_alert(self, router_id, router_name, server_name):
        """Gửi cảnh báo khi DHCP server ngừng hoạt động"""
        details = {
            "router_id": router_id,
            "server_name": server_name,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "dhcp_server_down", None, details)
    
    def _send_vpn_connection_failed_alert(self, router_id, router_name, vpn_type, details_info):
        """Gửi cảnh báo khi kết nối VPN thất bại"""
        details = {
            "router_id": router_id,
            "vpn_type": vpn_type,
            "vpn_details": details_info,
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "vpn_connection_failed", None, details)
    
    def _send_wireless_interference_alert(self, router_id, router_name, interface_name, signal_strength):
        """Gửi cảnh báo khi phát hiện nhiễu sóng wireless"""
        details = {
            "router_id": router_id,
            "interface": interface_name,
            "signal_strength": f"{signal_strength} dBm",
            "threshold": f"{self.config['alerts']['wireless_interference']['signal_threshold']} dBm",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        send_alert(router_name, "wireless_interference", None, details)


# Singleton instance
alert_monitor = AlertMonitor()

def start_monitoring():
    """Bắt đầu giám sát"""
    alert_monitor.start()

def stop_monitoring():
    """Dừng giám sát"""
    alert_monitor.stop()

if __name__ == "__main__":
    # Tạo thư mục logs nếu chưa tồn tại
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    # Khi chạy trực tiếp, bắt đầu giám sát
    logger.info("Đang khởi động hệ thống giám sát MikroTik...")
    
    try:
        start_monitoring()
        
        # Giữ tiến trình chạy
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Đã nhận lệnh dừng từ người dùng")
    finally:
        stop_monitoring()
        logger.info("Đã dừng hệ thống giám sát MikroTik")