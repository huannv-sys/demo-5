#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module để kiểm tra và theo dõi băng thông mạng trên thiết bị MikroTik.
Mô-đun này lấy dữ liệu từ RouterOS API và cung cấp các chức năng để phân tích
mức sử dụng băng thông, phát hiện sự cố và sinh cảnh báo.
"""

import os
import sys
import time
import json
import logging
from datetime import datetime, timedelta
import requests
import math

# Thêm thư mục gốc vào đường dẫn để import các module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from notifications import send_alert

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs', 'bandwidth_monitor.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('bandwidth_monitor')

class BandwidthMonitor:
    """
    Theo dõi và phân tích băng thông mạng trên thiết bị MikroTik.
    """
    
    def __init__(self, api_base_url="http://localhost:3000/api"):
        """Khởi tạo monitor"""
        self.api_base_url = api_base_url
        self.bandwidth_history = {}  # Lưu lịch sử dữ liệu băng thông
        self.interface_info = {}     # Lưu thông tin về các interface
        self.alert_history = {}      # Lưu lịch sử cảnh báo
        
    def get_router_connections(self):
        """Lấy danh sách các kết nối router từ API"""
        try:
            response = requests.get(f"{self.api_base_url}/connections", timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Lỗi khi lấy danh sách router: HTTP {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Lỗi khi lấy danh sách router: {e}")
            return []
    
    def get_router_interfaces(self, router_id):
        """Lấy danh sách interfaces của router từ API"""
        try:
            response = requests.get(f"{self.api_base_url}/routers/{router_id}/interfaces", timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Lỗi khi lấy interfaces của router {router_id}: HTTP {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Lỗi khi lấy interfaces của router {router_id}: {e}")
            return []
    
    def get_router_name(self, router_id):
        """Lấy tên router từ API"""
        try:
            response = requests.get(f"{self.api_base_url}/connections/{router_id}", timeout=10)
            if response.status_code == 200:
                router = response.json()
                return router.get('name', f'Router #{router_id}')
            else:
                return f"Router #{router_id}"
        except Exception:
            return f"Router #{router_id}"
    
    def get_interface_bandwidth(self, router_id, interface_name):
        """Lấy thông tin băng thông hiện tại của interface từ API"""
        try:
            # Đường dẫn API có thể cần điều chỉnh tùy thuộc vào cấu trúc API thực tế
            response = requests.get(
                f"{self.api_base_url}/routers/{router_id}/interface-traffic?interface={interface_name}",
                timeout=10
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Lỗi khi lấy thông tin băng thông: HTTP {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Lỗi khi lấy thông tin băng thông: {e}")
            return None
    
    def get_interface_speed(self, router_id, interface_name):
        """
        Lấy tốc độ tối đa của interface (nếu có).
        Trả về tốc độ theo bits/second hoặc None nếu không xác định được.
        """
        # Nếu đã có thông tin về interface này, lấy từ cache
        interface_key = f"{router_id}_{interface_name}"
        if interface_key in self.interface_info and 'max_speed' in self.interface_info[interface_key]:
            return self.interface_info[interface_key]['max_speed']
        
        try:
            # Lấy danh sách interfaces để tìm thông tin về interface cụ thể
            interfaces = self.get_router_interfaces(router_id)
            for interface in interfaces:
                if interface.get('name') == interface_name:
                    # Lấy tốc độ từ thuộc tính 'speed', 'max-speed' hoặc từ loại interface
                    speed = None
                    if 'speed' in interface:
                        speed = self._parse_speed(interface['speed'])
                    elif 'max-speed' in interface:
                        speed = self._parse_speed(interface['max-speed'])
                    elif 'type' in interface:
                        # Ước tính tốc độ dựa trên loại interface
                        speed = self._estimate_speed_from_type(interface['type'])
                    
                    # Lưu vào cache
                    if interface_key not in self.interface_info:
                        self.interface_info[interface_key] = {}
                    self.interface_info[interface_key]['max_speed'] = speed
                    return speed
            
            logger.warning(f"Không tìm thấy thông tin cho interface {interface_name} trên router {router_id}")
            return None
        except Exception as e:
            logger.error(f"Lỗi khi lấy tốc độ interface: {e}")
            return None
    
    def _parse_speed(self, speed_str):
        """
        Chuyển đổi chuỗi tốc độ thành giá trị bits/second.
        Ví dụ: '1Gbps' -> 1000000000
        """
        if not speed_str:
            return None
        
        try:
            # Xử lý các định dạng có thể có
            speed_str = str(speed_str).lower().strip()
            
            if 'gbps' in speed_str or 'gb/s' in speed_str:
                num = float(speed_str.replace('gbps', '').replace('gb/s', ''))
                return int(num * 1000000000)
            elif 'mbps' in speed_str or 'mb/s' in speed_str:
                num = float(speed_str.replace('mbps', '').replace('mb/s', ''))
                return int(num * 1000000)
            elif 'kbps' in speed_str or 'kb/s' in speed_str:
                num = float(speed_str.replace('kbps', '').replace('kb/s', ''))
                return int(num * 1000)
            else:
                # Thử chuyển đổi trực tiếp
                return int(float(speed_str))
        except Exception:
            return None
    
    def _estimate_speed_from_type(self, interface_type):
        """
        Ước tính tốc độ dựa trên loại interface.
        Trả về tốc độ ước tính theo bits/second.
        """
        interface_type = interface_type.lower()
        
        if 'ethernet' in interface_type or 'ether' in interface_type:
            # Giả sử Ethernet là 1Gbps
            return 1000000000
        elif 'fast' in interface_type:
            # Fast Ethernet là 100Mbps
            return 100000000
        elif 'giga' in interface_type:
            # Gigabit Ethernet là 1Gbps
            return 1000000000
        elif '10gbe' in interface_type or '10g' in interface_type:
            # 10 Gigabit Ethernet
            return 10000000000
        elif 'wifi' in interface_type or 'wireless' in interface_type:
            # Tốc độ WiFi trung bình (802.11n)
            return 300000000
        elif 'pppoe' in interface_type or 'ppp' in interface_type:
            # PPPoE thường có nhiều tốc độ khác nhau, giả sử 100Mbps
            return 100000000
        else:
            # Giá trị mặc định nếu không xác định được
            return 100000000
    
    def monitor_bandwidth(self, threshold_percent=80, interval_seconds=60, alert_cooldown_minutes=30):
        """
        Theo dõi băng thông của tất cả các router và phát cảnh báo khi vượt ngưỡng.
        
        Args:
            threshold_percent: Ngưỡng phần trăm sử dụng băng thông để phát cảnh báo
            interval_seconds: Khoảng thời gian giữa các lần kiểm tra (giây)
            alert_cooldown_minutes: Thời gian chờ giữa các cảnh báo (phút)
        """
        logger.info(f"Bắt đầu giám sát băng thông với ngưỡng {threshold_percent}%")
        
        while True:
            try:
                # Lấy danh sách router
                routers = self.get_router_connections()
                
                for router in routers:
                    router_id = router.get('id')
                    if not router_id:
                        continue
                    
                    # Kiểm tra trạng thái kết nối
                    if not self._is_router_connected(router_id):
                        logger.debug(f"Router {router_id} không kết nối, bỏ qua kiểm tra băng thông")
                        continue
                    
                    router_name = self.get_router_name(router_id)
                    
                    # Lấy danh sách interfaces
                    interfaces = self.get_router_interfaces(router_id)
                    
                    for interface in interfaces:
                        interface_name = interface.get('name')
                        if not interface_name:
                            continue
                        
                        # Bỏ qua loopback và các interfaces đã tắt
                        if interface_name == 'lo' or interface.get('disabled', False):
                            continue
                        
                        # Lấy thông tin băng thông hiện tại
                        bandwidth_data = self.get_interface_bandwidth(router_id, interface_name)
                        if not bandwidth_data:
                            continue
                        
                        # Phân tích dữ liệu băng thông
                        rx_bits = bandwidth_data.get('rx_bits_per_second', 0)
                        tx_bits = bandwidth_data.get('tx_bits_per_second', 0)
                        
                        # Thêm vào lịch sử để phân tích xu hướng
                        interface_key = f"{router_id}_{interface_name}"
                        if interface_key not in self.bandwidth_history:
                            self.bandwidth_history[interface_key] = []
                        
                        # Giới hạn lịch sử lưu trữ (giữ 60 mẫu gần nhất)
                        if len(self.bandwidth_history[interface_key]) >= 60:
                            self.bandwidth_history[interface_key].pop(0)
                        
                        self.bandwidth_history[interface_key].append({
                            'timestamp': datetime.now(),
                            'rx_bits': rx_bits,
                            'tx_bits': tx_bits
                        })
                        
                        # Lấy tốc độ interface
                        max_speed = self.get_interface_speed(router_id, interface_name)
                        
                        # Nếu không xác định được tốc độ tối đa, bỏ qua kiểm tra ngưỡng
                        if not max_speed:
                            logger.debug(f"Không xác định được tốc độ tối đa của {interface_name} trên {router_name}")
                            continue
                        
                        # Tính phần trăm sử dụng
                        current_usage = max(rx_bits, tx_bits)  # Lấy giá trị lớn nhất giữa RX và TX
                        usage_percent = (current_usage / max_speed) * 100
                        
                        logger.debug(f"{router_name} - {interface_name}: {usage_percent:.1f}% ({self._format_bits(current_usage)}/{self._format_bits(max_speed)})")
                        
                        # Kiểm tra ngưỡng
                        if usage_percent >= threshold_percent:
                            # Kiểm tra thời gian chờ giữa các cảnh báo
                            alert_key = f"high_bandwidth_{router_id}_{interface_name}"
                            cooldown_seconds = alert_cooldown_minutes * 60
                            
                            if self._can_send_alert(alert_key, cooldown_seconds):
                                logger.warning(f"Phát hiện sử dụng băng thông cao trên {router_name} - {interface_name}: {usage_percent:.1f}%")
                                self._send_bandwidth_alert(router_id, router_name, interface_name, current_usage, max_speed)
            
            except Exception as e:
                logger.error(f"Lỗi trong quá trình giám sát băng thông: {e}")
            
            # Chờ đến lần kiểm tra tiếp theo
            time.sleep(interval_seconds)
    
    def _is_router_connected(self, router_id):
        """Kiểm tra xem router có đang kết nối không"""
        try:
            response = requests.get(f"{self.api_base_url}/connections/{router_id}/status", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('connected', False)
            return False
        except Exception:
            return False
    
    def _can_send_alert(self, alert_key, cooldown_seconds):
        """Kiểm tra xem đã đủ thời gian để gửi lại cảnh báo chưa"""
        now = datetime.now()
        
        if alert_key not in self.alert_history:
            self.alert_history[alert_key] = now
            return True
        
        last_time = self.alert_history[alert_key]
        elapsed = (now - last_time).total_seconds()
        
        if elapsed >= cooldown_seconds:
            self.alert_history[alert_key] = now
            return True
        
        return False
    
    def _send_bandwidth_alert(self, router_id, router_name, interface_name, current_usage, max_speed):
        """Gửi cảnh báo khi sử dụng băng thông cao"""
        usage_percent = (current_usage / max_speed) * 100
        
        details = {
            "router_id": router_id,
            "interface": interface_name,
            "current_usage": self._format_bits(current_usage),
            "max_speed": self._format_bits(max_speed),
            "usage_percent": f"{usage_percent:.1f}%",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Phân tích xu hướng
        trend_info = self._analyze_bandwidth_trend(router_id, interface_name)
        if trend_info:
            details.update(trend_info)
        
        # Gửi cảnh báo
        send_alert(router_name, "high_bandwidth", None, details)
    
    def _analyze_bandwidth_trend(self, router_id, interface_name):
        """
        Phân tích xu hướng sử dụng băng thông.
        Trả về một dictionary với thông tin xu hướng.
        """
        interface_key = f"{router_id}_{interface_name}"
        
        if interface_key not in self.bandwidth_history or len(self.bandwidth_history[interface_key]) < 5:
            return None
        
        # Lấy 5 mẫu gần nhất
        recent_samples = self.bandwidth_history[interface_key][-5:]
        
        # Tính toán xu hướng
        rx_trend = []
        tx_trend = []
        
        for i in range(len(recent_samples) - 1):
            rx_diff = recent_samples[i+1]['rx_bits'] - recent_samples[i]['rx_bits']
            tx_diff = recent_samples[i+1]['tx_bits'] - recent_samples[i]['tx_bits']
            rx_trend.append(rx_diff)
            tx_trend.append(tx_diff)
        
        # Xác định xu hướng tổng thể
        avg_rx_trend = sum(rx_trend) / len(rx_trend)
        avg_tx_trend = sum(tx_trend) / len(tx_trend)
        
        trend_desc = "Ổn định"
        if avg_rx_trend > 0 and avg_tx_trend > 0:
            trend_desc = "Tăng"
        elif avg_rx_trend < 0 and avg_tx_trend < 0:
            trend_desc = "Giảm"
        elif avg_rx_trend > 0:
            trend_desc = "Download tăng"
        elif avg_tx_trend > 0:
            trend_desc = "Upload tăng"
        
        return {
            "trend": trend_desc,
            "avg_rx_change": self._format_bits(avg_rx_trend) + "/s",
            "avg_tx_change": self._format_bits(avg_tx_trend) + "/s"
        }
    
    def _format_bits(self, bits):
        """
        Định dạng bits thành chuỗi dễ đọc (bps, Kbps, Mbps, Gbps).
        """
        if bits == 0:
            return "0 bps"
        
        units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
        unit_index = min(int(math.log(abs(bits), 1000)), len(units)-1)
        
        value = bits / (1000 ** unit_index)
        return f"{value:.2f} {units[unit_index]}"

# Singleton instance
bandwidth_monitor = BandwidthMonitor()

if __name__ == "__main__":
    print("Khởi động giám sát băng thông...")
    
    # Tạo thư mục logs nếu chưa tồn tại
    logs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'logs')
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    try:
        # Bắt đầu giám sát với ngưỡng 80%, kiểm tra mỗi 60 giây, cooldown 30 phút
        bandwidth_monitor.monitor_bandwidth(threshold_percent=80, interval_seconds=60, alert_cooldown_minutes=30)
    except KeyboardInterrupt:
        print("Đã dừng giám sát băng thông.")