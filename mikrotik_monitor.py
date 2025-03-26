#!/usr/bin/env python3
"""
MikroTik Monitor - Công cụ giám sát thiết bị MikroTik
Kết nối đến API RouterOS và hiển thị thông tin quan trọng
"""

import os
import sys
import json
import time
import argparse
import requests
from datetime import datetime
from dotenv import load_dotenv

# Tải biến môi trường từ file .env
load_dotenv()

# Cấu hình từ biến môi trường hoặc cấu hình mặc định an toàn
DEFAULT_ROUTER = {
    "address": os.getenv("MIKROTIK_ADDRESS", "localhost"),
    "port": int(os.getenv("MIKROTIK_PORT", "8728")),
    "username": os.getenv("MIKROTIK_USERNAME", ""),
    "password": os.getenv("MIKROTIK_PASSWORD", "")
}
API_URL = os.getenv("API_URL", "http://localhost:3000/api")

def format_bytes(bytes_value, decimals=2):
    """Format số byte thành KB, MB, GB, TB"""
    if bytes_value == 0:
        return "0 Bytes"
    
    k = 1024
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
    i = int(bytes_value > 0 and float(bytes_value).is_integer() and 
            bytes_value.bit_length() // 10 or 0)
    
    return f"{bytes_value / (k ** i):.{decimals}f} {sizes[i]}"

def format_uptime(uptime_str):
    """Format chuỗi uptime để dễ đọc"""
    if "d" in uptime_str and "h" in uptime_str:
        return uptime_str  # Đã định dạng
    
    parts = uptime_str.split(":")
    if len(parts) != 3:
        return uptime_str
    
    h, m, s = parts
    if "s" in s:
        s = s.replace("s", "")
    
    h = int(h)
    days = h // 24
    hours = h % 24
    
    if days > 0:
        return f"{days}d {hours}h {m}m {s}s"
    else:
        return f"{hours}h {m}m {s}s"

def print_header(title):
    """In tiêu đề của phần thông tin"""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)

def print_info(label, value, prefix="  "):
    """In thông tin dạng nhãn: giá trị"""
    print(f"{prefix}{label}: {value}")

def get_resource_info(router_id=1):
    """Lấy thông tin tài nguyên từ router"""
    try:
        # Kết nối đến router
        response = requests.post(f"{API_URL}/connections/{router_id}/connect", 
                                json=DEFAULT_ROUTER)
        if response.status_code != 200:
            print(f"Lỗi kết nối: {response.json().get('message', 'Không rõ')}")
            return None
        
        # Lấy thông tin tài nguyên
        response = requests.get(f"{API_URL}/connections/{router_id}/resources")
        if response.status_code != 200:
            print(f"Lỗi lấy thông tin: {response.json().get('message', 'Không rõ')}")
            return None
        
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Lỗi kết nối API: {str(e)}")
        return None

def get_interfaces(router_id=1):
    """Lấy danh sách interfaces từ router"""
    try:
        response = requests.get(f"{API_URL}/connections/{router_id}/interfaces")
        if response.status_code != 200:
            print(f"Lỗi lấy interfaces: {response.json().get('message', 'Không rõ')}")
            return None
        
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Lỗi kết nối API: {str(e)}")
        return None

def monitor_resources(router_id=1, interval=5):
    """Giám sát tài nguyên theo thời gian thực"""
    try:
        print("\nĐang kết nối đến router để giám sát tài nguyên...")
        print("Nhấn Ctrl+C để dừng\n")
        
        while True:
            # Lấy thông tin tài nguyên
            resources = get_resource_info(router_id)
            if not resources:
                print("Không thể lấy thông tin tài nguyên. Đang thử lại...")
                time.sleep(interval)
                continue
            
            # Xóa màn hình
            os.system('cls' if os.name == 'nt' else 'clear')
            
            # Hiển thị thông tin
            print_header(f"GIÁM SÁT MIKROTIK - {resources.get('platform', 'Unknown')} - {datetime.now().strftime('%H:%M:%S')}")
            print_info("Model", resources.get('board', 'Unknown'))
            print_info("Phiên bản", resources.get('version', 'Unknown'))
            print_info("Thời gian hoạt động", format_uptime(resources.get('uptime', '00:00:00')))
            print_info("CPU Load", f"{resources.get('cpuLoad', 0)}%")
            
            # Thông tin bộ nhớ
            total_memory = int(resources.get('totalMemory', 0))
            free_memory = int(resources.get('freeMemory', 0))
            used_memory = total_memory - free_memory
            memory_percent = (used_memory / total_memory) * 100 if total_memory > 0 else 0
            
            print_info("RAM", f"{format_bytes(used_memory)}/{format_bytes(total_memory)} ({memory_percent:.1f}%)")
            
            # Thông tin ổ cứng
            total_hdd = int(resources.get('totalHdd', 0))
            free_hdd = int(resources.get('freeHdd', 0))
            used_hdd = total_hdd - free_hdd
            hdd_percent = (used_hdd / total_hdd) * 100 if total_hdd > 0 else 0
            
            print_info("HDD", f"{format_bytes(used_hdd)}/{format_bytes(total_hdd)} ({hdd_percent:.1f}%)")
            
            # Hiển thị interfaces
            interfaces = get_interfaces(router_id)
            if interfaces:
                print_header("INTERFACES")
                for i, iface in enumerate(interfaces):
                    status = "🟢 Hoạt động" if iface.get('running', False) else "🔴 Dừng"
                    if iface.get('disabled', False):
                        status = "⚪ Bị vô hiệu hóa"
                    
                    print_info(f"{iface.get('name', 'Unknown')}", f"{status} - {iface.get('type', 'Unknown')}")
                    if iface.get('macAddress'):
                        print_info("MAC", iface.get('macAddress', ''), "    ")
            
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nĐã dừng giám sát.")

def main():
    """Hàm chính của chương trình"""
    parser = argparse.ArgumentParser(description="Công cụ giám sát MikroTik")
    parser.add_argument("--interval", type=int, default=5, help="Khoảng thời gian làm mới (giây)")
    parser.add_argument("--router", type=int, default=1, help="ID của router")
    args = parser.parse_args()
    
    # Giám sát tài nguyên
    monitor_resources(args.router, args.interval)

if __name__ == "__main__":
    main()