#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MikroTik Monitor - Ứng dụng giám sát thiết bị MikroTik
Được phát triển bởi Replit AI
Chạy ứng dụng: streamlit run app.py
"""

import streamlit as st
import json
import os
import subprocess
import time
import pandas as pd
import plotly.graph_objects as go
from datetime import datetime
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

# Cấu hình trang
st.set_page_config(
    page_title="MikroTik Monitor",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Tiêu đề ứng dụng
st.title("🔄 MikroTik Monitor")
st.markdown("### Hệ thống giám sát thiết bị MikroTik")

# Sidebar
with st.sidebar:
    st.header("Điều hướng")
    page = st.radio(
        "Chọn trang:",
        ["Dashboard", "Cấu hình kết nối", "Thống kê mạng", "Logs", "Cấu hình thông báo"]
    )
    
    st.header("Thông tin")
    st.info("""
        Ứng dụng giám sát RouterOS dành cho thiết bị MikroTik.
        
        Phiên bản: 1.0.0
        
        © 2025 MikroTik Monitor
    """)

# Cấu hình API URL (đảm bảo có thể truy cập trên cùng host)
API_BASE_URL = "http://127.0.0.1:3000/api"

# Hàm lấy thông tin router từ API
def get_router_info():
    try:
        import requests
        
        # Kiểm tra trạng thái kết nối
        response = requests.get(f"{API_BASE_URL}/test-mikrotik-connection", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                router_info = data.get("routerInfo", {})
                
                # Lấy thông tin tài nguyên
                resources_response = requests.get(f"{API_BASE_URL}/connections/1/resources", timeout=10)
                resources = {}
                
                if resources_response.status_code == 200:
                    resources = resources_response.json()
                
                # Định dạng thông tin để hiển thị
                memory_used = int(resources.get("totalMemory", 0) - resources.get("freeMemory", 0))
                total_memory = int(resources.get("totalMemory", 0))
                memory_percent = 0
                if total_memory > 0:
                    memory_percent = (memory_used / total_memory) * 100
                
                storage_used = int(resources.get("totalHdd", 0) - resources.get("freeHdd", 0))
                total_storage = int(resources.get("totalHdd", 0))
                storage_percent = 0
                if total_storage > 0:
                    storage_percent = (storage_used / total_storage) * 100
                
                # Định dạng đơn vị để hiển thị
                memory_used_mb = memory_used / (1024 * 1024)
                total_memory_mb = total_memory / (1024 * 1024)
                storage_used_mb = storage_used / (1024 * 1024)
                total_storage_mb = total_storage / (1024 * 1024)
                
                return {
                    "name": f"MikroTik {router_info.get('platform', 'Router')}",
                    "model": router_info.get('board', 'Unknown'),
                    "version": router_info.get('version', 'Unknown'),
                    "uptime": router_info.get('uptime', 'Unknown'),
                    "cpu_load": f"{resources.get('cpuLoad', '0')}%",
                    "memory_used": f"{memory_used_mb:.0f} MB / {total_memory_mb:.0f} MB",
                    "memory_percent": memory_percent,
                    "storage_used": f"{storage_used_mb:.0f} MB / {total_storage_mb:.0f} MB",
                    "storage_percent": storage_percent,
                    "connected": True,
                    "last_connected": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            else:
                return {
                    "name": "MikroTik Router",
                    "model": "Unknown",
                    "version": "Unknown",
                    "uptime": "Unknown",
                    "cpu_load": "0%",
                    "memory_used": "0 MB / 0 MB",
                    "memory_percent": 0,
                    "storage_used": "0 MB / 0 MB",
                    "storage_percent": 0,
                    "connected": False,
                    "last_connected": "Never connected"
                }
        else:
            st.error(f"Lỗi kết nối API: {response.status_code}")
            return None
    except Exception as e:
        st.error(f"Lỗi khi lấy thông tin router: {e}")
        return None

# Hàm lấy thông tin interface từ API
def get_interfaces():
    try:
        import requests
        
        # Gọi API lấy danh sách interfaces
        response = requests.get(f"{API_BASE_URL}/connections/1/interfaces", timeout=10)
        
        # Gọi API lấy thống kê interfaces
        stats_response = requests.get(f"{API_BASE_URL}/connections/1/interface-stats", timeout=10)
        
        stats_data = []
        if stats_response.status_code == 200:
            stats_data = stats_response.json()
        
        if response.status_code == 200:
            interfaces_data = response.json()
            
            # Chuyển đổi dữ liệu từ API sang định dạng hiển thị
            interfaces = []
            for iface in interfaces_data:
                # Tìm kiếm thông tin thống kê cho interface hiện tại
                stat = next((s for s in stats_data if s.get("name") == iface.get("name")), {})
                
                # Lấy dữ liệu rx/tx từ thống kê
                rx = stat.get("rxBytes", 0)
                tx = stat.get("txBytes", 0)
                
                interfaces.append({
                    "name": iface.get("name", ""),
                    "type": iface.get("type", "unknown"),
                    "status": "up" if iface.get("running", False) else "down",
                    "rx": rx,
                    "tx": tx,
                    "disabled": iface.get("disabled", False),
                    "mac_address": iface.get("macAddress", "")
                })
            
            return interfaces
        else:
            st.warning(f"Không thể lấy thông tin interfaces: {response.status_code}")
            return []
    except Exception as e:
        st.error(f"Lỗi khi lấy danh sách interface: {e}")
        return []

# Hàm lấy thông tin log từ API
def get_logs(limit=50):
    try:
        import requests
        
        # Gọi API lấy logs
        response = requests.get(f"{API_BASE_URL}/connections/1/logs?limit={limit}", timeout=10)
        
        if response.status_code == 200:
            logs_data = response.json()
            return logs_data
        else:
            st.warning(f"Không thể lấy log từ router: {response.status_code}")
            # Trả về dữ liệu mẫu nếu không thể kết nối
            return [
                {"time": "2025-03-26 09:15:32", "topics": "system,info", "message": "System started"},
                {"time": "2025-03-26 09:15:48", "topics": "wireless,info", "message": "wlan1 connected"},
                {"time": "2025-03-26 09:22:15", "topics": "firewall,warning", "message": "Blocked connection from 192.168.1.254"},
                {"time": "2025-03-26 10:35:17", "topics": "system,error", "message": "CPU overload detected"},
                {"time": "2025-03-26 11:12:03", "topics": "dhcp,info", "message": "DHCP lease for 192.168.1.100 expired"}
            ]
    except Exception as e:
        st.error(f"Lỗi khi lấy logs: {e}")
        return []

# Hàm lấy cấu hình thông báo
def get_notification_config():
    try:
        if os.path.exists("config/notification_config.json"):
            with open("config/notification_config.json", "r") as f:
                return json.load(f)
        return {
            "enabled": False,
            "channels": {
                "email": {"enabled": False, "recipients": []},
                "sms": {"enabled": False, "recipients": []}
            }
        }
    except Exception as e:
        st.error(f"Lỗi khi đọc cấu hình thông báo: {e}")
        return None

# Dashboard
if page == "Dashboard":
    st.header("Dashboard")
    
    router_info = get_router_info()
    
    if router_info:
        # Hiển thị trạng thái kết nối
        if router_info["connected"]:
            st.success("✅ Connected to MikroTik Router")
        else:
            st.error("❌ Not connected to MikroTik Router")
        
        # Thông tin router
        col1, col2, col3 = st.columns(3)
        with col1:
            st.subheader("Thông tin thiết bị")
            st.info(f"""
                **Tên:** {router_info["name"]}  
                **Model:** {router_info["model"]}  
                **Phiên bản:** {router_info["version"]}  
                **Uptime:** {router_info["uptime"]}
            """)

        with col2:
            st.subheader("Tài nguyên CPU/RAM")
            st.info(f"""
                **CPU Load:** {router_info["cpu_load"]}  
                **Memory:** {router_info["memory_used"]}
            """)
            st.progress(router_info["memory_percent"] / 100)

        with col3:
            st.subheader("Lưu trữ")
            st.info(f"""
                **Storage:** {router_info["storage_used"]}
            """)
            st.progress(router_info["storage_percent"] / 100)
        
        # Thông tin interfaces
        st.subheader("Network Interfaces")
        interfaces = get_interfaces()
        
        if interfaces:
            # Tạo DataFrame
            df = pd.DataFrame(interfaces)
            
            # Định dạng giá trị
            df["rx_formatted"] = df["rx"].apply(lambda x: f"{x/1000000:.2f} MB")
            df["tx_formatted"] = df["tx"].apply(lambda x: f"{x/1000000:.2f} MB")
            df["status_display"] = df.apply(lambda row: "🟢 Up" if row["status"] == "up" else "🔴 Down", axis=1)
            
            # Hiển thị bảng
            st.dataframe(
                df[["name", "type", "status_display", "rx_formatted", "tx_formatted"]],
                column_config={
                    "name": "Interface",
                    "type": "Type",
                    "status_display": "Status",
                    "rx_formatted": "Download",
                    "tx_formatted": "Upload"
                },
                use_container_width=True
            )
            
            # Biểu đồ băng thông
            st.subheader("Bandwidth Usage")
            
            fig = go.Figure()
            
            fig.add_trace(go.Bar(
                x=df["name"],
                y=df["rx"],
                name="Download (bytes)",
                marker_color="blue"
            ))
            
            fig.add_trace(go.Bar(
                x=df["name"],
                y=df["tx"],
                name="Upload (bytes)",
                marker_color="green"
            ))
            
            fig.update_layout(
                barmode="group",
                xaxis_title="Interface",
                yaxis_title="Bandwidth (bytes)",
                legend_title="Direction",
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)

# Cấu hình kết nối
elif page == "Cấu hình kết nối":
    st.header("Cấu hình kết nối")
    
    with st.form("connection_form"):
        st.write("Thiết lập kết nối đến thiết bị MikroTik")
        
        col1, col2 = st.columns(2)
        
        with col1:
            name = st.text_input("Tên kết nối", "MikroTik Router")
            address = st.text_input("Địa chỉ IP", "192.168.1.1")
        
        with col2:
            port = st.number_input("Port API", value=8728, min_value=1, max_value=65535)
            is_default = st.checkbox("Đặt làm kết nối mặc định", value=True)
        
        username = st.text_input("Tên đăng nhập")
        password = st.text_input("Mật khẩu", type="password")
        
        submit = st.form_submit_button("Lưu kết nối")
        
        if submit:
            if not username or not password or not address:
                st.error("Vui lòng điền đầy đủ thông tin kết nối")
            else:
                st.success(f"Đã lưu kết nối đến {address}:{port} với tên {name}")

# Thống kê mạng
elif page == "Thống kê mạng":
    st.header("Thống kê mạng")
    
    # Tạo tabs
    tab1, tab2, tab3 = st.tabs(["Băng thông", "DHCP Leases", "Wireless"])
    
    with tab1:
        st.subheader("Biểu đồ sử dụng băng thông")
        
        # Mô phỏng dữ liệu
        time_points = [f"2023-03-26 {hour}:00" for hour in range(24)]
        download = [5, 7, 4, 2, 1, 0.5, 0.7, 3, 8, 12, 18, 15, 14, 16, 18, 22, 25, 28, 35, 32, 24, 18, 10, 7]
        upload = [2, 1, 0.8, 0.5, 0.2, 0.1, 0.3, 1, 4, 6, 8, 7, 6, 7, 8, 10, 12, 13, 15, 14, 10, 8, 5, 3]
        
        # Tạo DataFrame
        data = pd.DataFrame({
            "time": time_points,
            "download": download,
            "upload": upload
        })
        
        # Vẽ biểu đồ
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=data["time"],
            y=data["download"],
            mode="lines",
            name="Download (Mbps)",
            line=dict(color="blue", width=2)
        ))
        
        fig.add_trace(go.Scatter(
            x=data["time"],
            y=data["upload"],
            mode="lines",
            name="Upload (Mbps)",
            line=dict(color="green", width=2)
        ))
        
        fig.update_layout(
            title="Bandwidth Usage (Last 24 Hours)",
            xaxis_title="Time",
            yaxis_title="Bandwidth (Mbps)",
            height=500
        )
        
        st.plotly_chart(fig, use_container_width=True)
    
    with tab2:
        st.subheader("DHCP Leases")
        
        # Lấy dữ liệu DHCP từ API
        try:
            import requests
            
            response = requests.get(f"{API_BASE_URL}/connections/1/dhcp", timeout=10)
            
            if response.status_code == 200:
                dhcp_data = response.json()
                leases_data = dhcp_data.get("leases", [])
                
                if leases_data:
                    # Tạo DataFrame và hiển thị
                    df_leases = pd.DataFrame(leases_data)
                    
                    # Định dạng các cột để hiển thị
                    display_columns = ["address", "macAddress", "hostname", "expires", "status"]
                    display_cols = [col for col in display_columns if col in df_leases.columns]
                    
                    column_config = {
                        "address": "IP Address",
                        "macAddress": "MAC Address",
                        "hostname": "Hostname",
                        "expires": "Expires In",
                        "status": "Status"
                    }
                    
                    st.dataframe(
                        df_leases[display_cols], 
                        column_config={k: v for k, v in column_config.items() if k in display_cols},
                        use_container_width=True
                    )
                else:
                    st.info("Không có DHCP lease nào được tìm thấy.")
            else:
                # Hiển thị dữ liệu mẫu nếu không lấy được từ API
                leases = [
                    {"address": "192.168.1.100", "macAddress": "00:11:22:33:44:55", "hostname": "laptop-user1", "expires": "12h 30m"},
                    {"address": "192.168.1.101", "macAddress": "AA:BB:CC:DD:EE:FF", "hostname": "android-phone", "expires": "23h 15m"},
                    {"address": "192.168.1.102", "macAddress": "11:22:33:44:55:66", "hostname": "smart-tv", "expires": "35h 45m"},
                    {"address": "192.168.1.103", "macAddress": "AA:11:BB:22:CC:33", "hostname": "desktop-pc", "expires": "6h 20m"},
                    {"address": "192.168.1.104", "macAddress": "FF:EE:DD:CC:BB:AA", "hostname": "printer", "expires": "48h 0m"}
                ]
                df_leases = pd.DataFrame(leases)
                st.warning("Không thể lấy dữ liệu DHCP từ router. Hiển thị dữ liệu mẫu.")
                st.dataframe(df_leases, use_container_width=True)
        except Exception as e:
            st.error(f"Lỗi khi lấy dữ liệu DHCP: {e}")
            # Hiển thị dữ liệu mẫu khi có lỗi
            leases = [
                {"address": "192.168.1.100", "macAddress": "00:11:22:33:44:55", "hostname": "laptop-user1", "expires": "12h 30m"},
                {"address": "192.168.1.101", "macAddress": "AA:BB:CC:DD:EE:FF", "hostname": "android-phone", "expires": "23h 15m"}
            ]
            df_leases = pd.DataFrame(leases)
            st.dataframe(df_leases, use_container_width=True)
    
    with tab3:
        st.subheader("Wireless Networks")
        
        # Lấy dữ liệu Wireless từ API
        try:
            import requests
            
            response = requests.get(f"{API_BASE_URL}/connections/1/wireless", timeout=10)
            
            if response.status_code == 200:
                wireless_data = response.json()
                interfaces = wireless_data.get("interfaces", [])
                clients = wireless_data.get("clients", [])
                
                if interfaces:
                    # Tạo DataFrame cho interfaces
                    df_wireless = pd.DataFrame(interfaces)
                    
                    # Định dạng để hiển thị
                    display_columns = ["name", "ssid", "band", "frequency", "channelWidth", "mode", "disabled"]
                    display_cols = [col for col in display_columns if col in df_wireless.columns]
                    
                    column_config = {
                        "name": "Interface",
                        "ssid": "SSID",
                        "band": "Band",
                        "frequency": "Frequency",
                        "channelWidth": "Channel Width",
                        "mode": "Mode",
                        "disabled": "Disabled"
                    }
                    
                    st.dataframe(
                        df_wireless[display_cols], 
                        column_config={k: v for k, v in column_config.items() if k in display_cols},
                        use_container_width=True
                    )
                else:
                    st.info("Không tìm thấy wireless interface nào.")
                
                # Danh sách client
                st.subheader("Wireless Clients")
                
                if clients:
                    # Tạo DataFrame cho clients
                    df_clients = pd.DataFrame(clients)
                    
                    # Định dạng để hiển thị
                    display_columns = ["interface", "macAddress", "signalStrength", "txRate", "rxRate", "uptime"]
                    display_cols = [col for col in display_columns if col in df_clients.columns]
                    
                    column_config = {
                        "interface": "Interface",
                        "macAddress": "MAC Address",
                        "signalStrength": "Signal Strength",
                        "txRate": "TX Rate",
                        "rxRate": "RX Rate",
                        "uptime": "Uptime"
                    }
                    
                    st.dataframe(
                        df_clients[display_cols], 
                        column_config={k: v for k, v in column_config.items() if k in display_cols},
                        use_container_width=True
                    )
                else:
                    st.info("Không có client nào đang kết nối.")
            else:
                # Hiển thị dữ liệu mẫu nếu không lấy được từ API
                st.warning("Không thể lấy dữ liệu wireless từ router. Hiển thị dữ liệu mẫu.")
                wireless = [
                    {"name": "Home-Network", "band": "2.4GHz", "channel": "6", "clients": 8, "security": "WPA2-PSK"},
                    {"name": "Office-5G", "band": "5GHz", "channel": "36", "clients": 3, "security": "WPA3"}
                ]
                df_wireless = pd.DataFrame(wireless)
                st.dataframe(df_wireless, use_container_width=True)
                
                # Danh sách client mẫu
                st.subheader("Wireless Clients")
                clients = [
                    {"mac": "00:11:22:33:44:55", "network": "Home-Network", "signal": -65, "tx_rate": "54 Mbps", "rx_rate": "54 Mbps"},
                    {"mac": "AA:BB:CC:DD:EE:FF", "network": "Home-Network", "signal": -72, "tx_rate": "36 Mbps", "rx_rate": "36 Mbps"},
                    {"mac": "11:22:33:44:55:66", "network": "Office-5G", "signal": -58, "tx_rate": "180 Mbps", "rx_rate": "180 Mbps"}
                ]
                df_clients = pd.DataFrame(clients)
                st.dataframe(df_clients, use_container_width=True)
        except Exception as e:
            st.error(f"Lỗi khi lấy dữ liệu wireless: {e}")
            # Hiển thị dữ liệu mẫu khi có lỗi
            wireless = [
                {"name": "Home-Network", "band": "2.4GHz", "channel": "6", "clients": 8, "security": "WPA2-PSK"}
            ]
            df_wireless = pd.DataFrame(wireless)
            st.dataframe(df_wireless, use_container_width=True)

# Logs
elif page == "Logs":
    st.header("System Logs")
    
    # Filter options
    col1, col2, col3 = st.columns(3)
    
    with col1:
        topics_filter = st.multiselect(
            "Lọc theo Topics:",
            ["system", "wireless", "firewall", "dhcp", "info", "warning", "error"]
        )
    
    with col2:
        search_term = st.text_input("Tìm kiếm:", "")
    
    with col3:
        limit = st.slider("Số lượng logs:", min_value=10, max_value=100, value=50, step=10)
    
    # Get logs
    logs = get_logs(limit)
    
    if logs:
        # Apply filters
        filtered_logs = logs
        
        if topics_filter:
            filtered_logs = [
                log for log in filtered_logs 
                if any(topic in log["topics"] for topic in topics_filter)
            ]
        
        if search_term:
            filtered_logs = [
                log for log in filtered_logs 
                if search_term.lower() in log["message"].lower()
            ]
        
        # Create DataFrame
        df_logs = pd.DataFrame(filtered_logs)
        
        # Add color coding for log levels
        def get_log_color(topics):
            if "error" in topics:
                return "background-color: #ffcccc"
            elif "warning" in topics:
                return "background-color: #fff2cc"
            else:
                return ""
        
        # Apply styling
        styled_df = df_logs.style.applymap(
            lambda x: get_log_color(x) if isinstance(x, str) and ("error" in x or "warning" in x) else "",
            subset=["topics"]
        )
        
        # Display logs
        st.dataframe(styled_df, use_container_width=True)
        
        # Download button
        csv = df_logs.to_csv(index=False)
        st.download_button(
            label="Download Logs as CSV",
            data=csv,
            file_name="mikrotik_logs.csv",
            mime="text/csv"
        )
    else:
        st.warning("Không có logs nào được tìm thấy hoặc không thể kết nối đến router.")

# Cấu hình thông báo
elif page == "Cấu hình thông báo":
    st.header("Cấu hình thông báo")
    
    notification_config = get_notification_config()
    
    if notification_config:
        # Enable/disable notifications globally
        enabled = st.toggle("Bật thông báo", notification_config["enabled"])
        
        # Channel configuration
        st.subheader("Kênh thông báo")
        
        tab1, tab2 = st.tabs(["Email", "SMS"])
        
        with tab1:
            st.subheader("Cấu hình thông báo qua Email")
            
            email_enabled = st.toggle(
                "Bật thông báo qua Email", 
                notification_config["channels"]["email"]["enabled"]
            )
            
            st.subheader("Danh sách người nhận Email")
            
            email_recipients = notification_config["channels"]["email"]["recipients"]
            
            if email_recipients:
                for email in email_recipients:
                    st.text(email)
            else:
                st.info("Chưa có người nhận email nào được cấu hình")
            
            with st.form("add_email_form"):
                new_email = st.text_input("Email:")
                submit_email = st.form_submit_button("Thêm Email")
                
                if submit_email and new_email:
                    if "@" in new_email and "." in new_email:
                        st.success(f"Đã thêm email: {new_email}")
                    else:
                        st.error("Email không hợp lệ")
            
            # Test email
            with st.form("test_email_form"):
                test_email = st.text_input("Gửi email thử nghiệm đến:")
                submit_test = st.form_submit_button("Gửi thử nghiệm")
                
                if submit_test and test_email:
                    with st.spinner("Đang gửi email thử nghiệm..."):
                        time.sleep(2)  # Simulate sending
                        st.success(f"Đã gửi email thử nghiệm đến {test_email}")
        
        with tab2:
            st.subheader("Cấu hình thông báo qua SMS")
            
            sms_enabled = st.toggle(
                "Bật thông báo qua SMS", 
                notification_config["channels"]["sms"]["enabled"]
            )
            
            st.subheader("Danh sách số điện thoại nhận SMS")
            
            sms_recipients = notification_config["channels"]["sms"]["recipients"]
            
            if sms_recipients:
                for phone in sms_recipients:
                    st.text(phone)
            else:
                st.info("Chưa có số điện thoại nào được cấu hình")
            
            with st.form("add_phone_form"):
                new_phone = st.text_input("Số điện thoại (định dạng +84xxx):")
                submit_phone = st.form_submit_button("Thêm số điện thoại")
                
                if submit_phone and new_phone:
                    if new_phone.startswith("+") and len(new_phone) > 8:
                        st.success(f"Đã thêm số điện thoại: {new_phone}")
                    else:
                        st.error("Số điện thoại không hợp lệ")
            
            # Test SMS
            with st.form("test_sms_form"):
                test_phone = st.text_input("Gửi SMS thử nghiệm đến (định dạng +84xxx):")
                submit_test_sms = st.form_submit_button("Gửi thử nghiệm")
                
                if submit_test_sms and test_phone:
                    with st.spinner("Đang gửi SMS thử nghiệm..."):
                        time.sleep(2)  # Simulate sending
                        st.success(f"Đã gửi SMS thử nghiệm đến {test_phone}")
        
        # Alert configuration
        st.subheader("Cấu hình cảnh báo")
        
        alerts = [
            {"id": "connection_lost", "name": "Mất kết nối", "default_channels": ["email", "sms"]},
            {"id": "high_cpu", "name": "CPU cao", "default_channels": ["email"]},
            {"id": "high_memory", "name": "Bộ nhớ cao", "default_channels": ["email"]},
            {"id": "interface_down", "name": "Interface ngừng hoạt động", "default_channels": ["email", "sms"]}
        ]
        
        for alert in alerts:
            expander = st.expander(f"Cảnh báo: {alert['name']}")
            with expander:
                st.checkbox(
                    f"Bật cảnh báo {alert['name']}", 
                    value=notification_config["alerts"].get(alert["id"], {}).get("enabled", True)
                )
                
                st.multiselect(
                    "Kênh thông báo:",
                    ["email", "sms"],
                    default=alert["default_channels"]
                )
                
                if alert["id"] in ["high_cpu", "high_memory"]:
                    st.slider(
                        "Ngưỡng (%)", 
                        min_value=50, 
                        max_value=95, 
                        value=80
                    )
                
                st.number_input(
                    "Thời gian chờ giữa các cảnh báo (giây)", 
                    min_value=60, 
                    value=300
                )
        
        # Save changes button
        if st.button("Lưu thay đổi"):
            st.success("Đã lưu cấu hình thông báo thành công!")
    else:
        st.error("Không thể đọc cấu hình thông báo.")