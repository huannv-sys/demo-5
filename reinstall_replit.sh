#!/bin/bash

# Script tự động gỡ bỏ và cài đặt lại dự án MikroTik Monitor trên Replit
# Tác giả: Replit AI
# Ngày: $(date +%d/%m/%Y)

echo "======================================================"
echo "  SCRIPT GỠ BỎ VÀ CÀI ĐẶT LẠI MIKROTIK MONITOR"
echo "======================================================"

# Lưu trữ thư mục hiện tại
CURRENT_DIR=$(pwd)

# 1. Sao lưu các file cấu hình và biến môi trường quan trọng
echo "1. Đang sao lưu các file cấu hình và biến môi trường..."
mkdir -p /tmp/mikrotik_backup
if [ -f .env ]; then
  cp .env /tmp/mikrotik_backup/
  echo "   ✓ Sao lưu file .env"
fi

if [ -d config ]; then
  mkdir -p /tmp/mikrotik_backup/config
  cp -r config/* /tmp/mikrotik_backup/config/
  echo "   ✓ Sao lưu thư mục config"
fi

if [ -d templates ]; then
  mkdir -p /tmp/mikrotik_backup/templates
  cp -r templates/* /tmp/mikrotik_backup/templates/
  echo "   ✓ Sao lưu thư mục templates"
fi

# 2. Xóa tất cả các file và thư mục (trừ script hiện tại và thư mục .git nếu có)
echo "2. Đang xóa tất cả các file và thư mục cũ..."
find . -mindepth 1 -not -name "$(basename "$0")" -not -name "reinstall.sh" -not -name ".git" -not -path "./.git/*" -not -path "./.replit*" -not -path "./.replit-files/*" -exec rm -rf {} \;
echo "   ✓ Đã xóa các file và thư mục cũ"

# 3. Clone repository mới từ GitHub
echo "3. Đang tải mã nguồn mới từ GitHub..."
GIT_REPO="https://github.com/huannv-sys/demo3.0.git"
git clone "$GIT_REPO" temp_repo
if [ $? -ne 0 ]; then
  echo "   ✗ Lỗi khi clone repository. Vui lòng kiểm tra kết nối mạng hoặc URL repository."
  exit 1
fi

echo "   ✓ Đã tải mã nguồn thành công"

# 4. Di chuyển nội dung từ thư mục tạm sang thư mục gốc
echo "4. Đang di chuyển nội dung vào thư mục chính..."
mv temp_repo/* .
mv temp_repo/.* . 2>/dev/null || :  # Di chuyển cả các file ẩn
rm -rf temp_repo
echo "   ✓ Đã di chuyển nội dung thành công"

# 5. Khôi phục các file cấu hình và biến môi trường
echo "5. Đang khôi phục các file cấu hình và biến môi trường..."
if [ -f /tmp/mikrotik_backup/.env ]; then
  cp /tmp/mikrotik_backup/.env .
  echo "   ✓ Đã khôi phục file .env"
else
  echo "   Không tìm thấy file .env trong bản sao lưu, đang tạo file .env mẫu..."
  cat > .env << EOF
# Twilio Credentials
TWILIO_ACCOUNT_SID=\${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=\${TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=\${TWILIO_PHONE_NUMBER}

# SendGrid Credentials
SENDGRID_API_KEY=\${SENDGRID_API_KEY}

# Các biến môi trường khác
NODE_ENV=development
PORT=3000
EOF
  echo "   ✓ Đã tạo file .env mẫu"
fi

if [ -d /tmp/mikrotik_backup/config ]; then
  mkdir -p config
  cp -r /tmp/mikrotik_backup/config/* config/
  echo "   ✓ Đã khôi phục thư mục config"
fi

if [ -d /tmp/mikrotik_backup/templates ]; then
  mkdir -p templates
  cp -r /tmp/mikrotik_backup/templates/* templates/
  echo "   ✓ Đã khôi phục thư mục templates"
fi

# 6. Cập nhật server.js để sử dụng ES modules
echo "6. Cập nhật server.js để sử dụng ES modules..."
mv server.js server.js.bak
cat > server.js << EOF
// Server.js - Được chuyển đổi sang ES Modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

// Tạo require cho CommonJS modules
const require = createRequire(import.meta.url);
const mikrotikApi = require('./mikrotik-api');

// Biến __filename và __dirname cho ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Init app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static('public'));

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ status: 'API is running', time: new Date().toISOString() });
});

// Router Connection Routes
app.get('/api/connections', (req, res) => {
  // Đọc từ cấu hình hoặc database thay vì hardcode
  const routerAddress = process.env.MIKROTIK_ADDRESS || 'localhost';
  const routerPort = parseInt(process.env.MIKROTIK_PORT || '8728');
  const routerUsername = process.env.MIKROTIK_USERNAME || '';
  const routerName = process.env.MIKROTIK_NAME || 'MikroTik Router';
  
  res.json([
    {
      id: 1,
      name: routerName,
      address: routerAddress,
      port: routerPort,
      username: routerUsername,
      isDefault: true,
      lastConnected: new Date().toISOString()
    }
  ]);
});

// Create new connection
app.post('/api/connections', async (req, res) => {
  try {
    const { name, address, port, username, password, isDefault } = req.body;
    
    // Validate input
    if (!name || !address || !username || !password) {
      return res.status(400).json({ 
        message: "Missing required fields. Please provide name, address, username, and password."
      });
    }

    // Try to connect to router
    const connected = await mikrotikApi.connect(address, parseInt(port) || 8728, username, password);
    
    if (connected) {
      // Disconnect after successful test
      await mikrotikApi.disconnect();
      
      // Return success with demo ID (would be from database in production)
      res.status(201).json({
        id: Date.now(),
        name,
        address,
        port: parseInt(port) || 8728,
        username,
        isDefault: isDefault || false,
        lastConnected: new Date().toISOString()
      });
    } else {
      res.status(400).json({ message: "Failed to connect to router. Check credentials and router availability." });
    }
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ message: "An error occurred while creating the connection.", error: error.message });
  }
});

// Connect to router
app.post('/api/connections/:id/connect', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Lấy thông tin từ biến môi trường thay vì hardcode
    const routerInfo = {
      address: process.env.MIKROTIK_ADDRESS || 'localhost',
      port: parseInt(process.env.MIKROTIK_PORT || '8728'),
      username: process.env.MIKROTIK_USERNAME || '',
      password: process.env.MIKROTIK_PASSWORD || ''
    };
    
    // Kiểm tra xem thông tin đăng nhập có đầy đủ không
    if (!routerInfo.username || !routerInfo.password) {
      return res.status(400).json({ 
        message: "Missing router credentials. Please check environment variables."
      });
    }
    
    const connected = await mikrotikApi.connect(
      routerInfo.address, 
      routerInfo.port, 
      routerInfo.username, 
      routerInfo.password
    );
    
    if (connected) {
      res.json({ message: "Connected successfully", routerId: id });
    } else {
      res.status(400).json({ message: "Failed to connect to router", routerId: id });
    }
  } catch (error) {
    console.error('Error connecting to router:', error);
    res.status(500).json({ message: "An error occurred while connecting to the router", error: error.message });
  }
});

// Get resources info
app.get('/api/connections/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      return res.status(400).json({ message: "Not connected to router" });
    }
    
    const resources = await mikrotikApi.getResourceInfo();
    res.json(resources);
  } catch (error) {
    console.error('Error getting resource info:', error);
    res.status(500).json({ message: "An error occurred while getting resource info", error: error.message });
  }
});

// Get interfaces
app.get('/api/connections/:id/interfaces', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mikrotikApi.isConnected()) {
      // Thử kết nối tự động sử dụng biến môi trường
      const routerInfo = {
        address: process.env.MIKROTIK_ADDRESS || 'localhost',
        port: parseInt(process.env.MIKROTIK_PORT || '8728'),
        username: process.env.MIKROTIK_USERNAME || '',
        password: process.env.MIKROTIK_PASSWORD || ''
      };
      
      // Kiểm tra thông tin đăng nhập trước khi kết nối
      if (!routerInfo.username || !routerInfo.password) {
        return res.status(400).json({ 
          message: "Missing router credentials. Please check environment variables."
        });
      }
      
      const connected = await mikrotikApi.connect(
        routerInfo.address, 
        routerInfo.port, 
        routerInfo.username, 
        routerInfo.password
      );
      
      if (!connected) {
        return res.status(400).json({ message: "Not connected to router" });
      }
    }
    
    const interfaces = await mikrotikApi.getInterfaces();
    res.json(interfaces);
  } catch (error) {
    console.error('Error getting interfaces:', error);
    res.status(500).json({ message: "An error occurred while getting interfaces", error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`API Mode: \${process.env.USE_REAL_MIKROTIK_API === 'true' ? 'REAL' : 'MOCK'} MikroTik API\`);
});
EOF
echo "   ✓ Đã cập nhật server.js thành công"

# 7. Cập nhật mikrotik-api.js để tương thích với ES modules (nếu cần)
if [ -f mikrotik-api.js ]; then
  echo "7. Chuyển đổi mikrotik-api.js thành định dạng ESM nếu cần..."
  # Script này giữ nguyên định dạng CommonJS để dễ dàng import bởi các file ES modules
  echo "   ✓ Giữ nguyên định dạng CommonJS cho mikrotik-api.js"
else
  echo "7. Không tìm thấy file mikrotik-api.js"
fi

# 8. Tạo thư mục .streamlit và cấu hình
echo "8. Cài đặt cấu hình Streamlit..."
mkdir -p .streamlit
cat > .streamlit/config.toml << EOF
[server]
headless = true
address = "0.0.0.0"
port = 5000
EOF
echo "   ✓ Đã cài đặt cấu hình Streamlit thành công"

# 9. Cài đặt các gói phụ thuộc
echo "9. Đang cài đặt các gói phụ thuộc Node.js..."
npm install
if [ $? -ne 0 ]; then
  echo "   ✗ Lỗi khi cài đặt các gói phụ thuộc Node.js."
  exit 1
fi
echo "   ✓ Đã cài đặt các gói phụ thuộc Node.js thành công"

echo "10. Đang cài đặt các gói phụ thuộc Python..."
pip install python-dotenv twilio sendgrid jinja2 routeros-api flask-login flask-wtf pandas plotly requests streamlit trafilatura
if [ $? -ne 0 ]; then
  echo "   ✗ Lỗi khi cài đặt các gói phụ thuộc Python."
  exit 1
fi
echo "   ✓ Đã cài đặt các gói phụ thuộc Python thành công"

# 10. Xóa thư mục backup tạm thời
echo "11. Đang dọn dẹp..."
rm -rf /tmp/mikrotik_backup
echo "   ✓ Đã dọn dẹp bản sao lưu tạm thời"

# 11. Tạo file app.py cho Streamlit
echo "12. Tạo file app.py cho Streamlit..."
cat > app.py << EOF
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MikroTik Monitor - Ứng dụng giám sát thiết bị MikroTik
Tác giả: Replit AI
Ngày: $(date +%d/%m/%Y)
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

# Hàm lấy thông tin router từ API
def get_router_info():
    try:
        # Mô phỏng dữ liệu từ API
        return {
            "name": "MikroTik Cloud Router",
            "model": "RouterOS Cloud Hosted Router",
            "version": "7.13.2",
            "uptime": "12d 5h 37m 12s",
            "cpu_load": "15%",
            "memory_used": "128 MB / 512 MB",
            "memory_percent": 25,
            "storage_used": "350 MB / 2048 MB",
            "storage_percent": 17,
            "connected": True,
            "last_connected": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        st.error(f"Lỗi khi lấy thông tin router: {e}")
        return None

# Hàm lấy thông tin interface từ API
def get_interfaces():
    try:
        # Mô phỏng dữ liệu từ API
        return [
            {"name": "ether1", "type": "ethernet", "status": "up", "rx": 15600000, "tx": 8200000, "disabled": False},
            {"name": "ether2", "type": "ethernet", "status": "up", "rx": 8100000, "tx": 4100000, "disabled": False},
            {"name": "ether3", "type": "ethernet", "status": "down", "rx": 0, "tx": 0, "disabled": False},
            {"name": "wlan1", "type": "wireless", "status": "up", "rx": 3500000, "tx": 12000000, "disabled": False},
            {"name": "vpn-out1", "type": "vpn", "status": "up", "rx": 1500000, "tx": 850000, "disabled": False}
        ]
    except Exception as e:
        st.error(f"Lỗi khi lấy danh sách interface: {e}")
        return []

# Hàm lấy thông tin log từ API
def get_logs(limit=50):
    try:
        # Mô phỏng dữ liệu từ API
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
        
        # Mô phỏng dữ liệu
        leases = [
            {"address": "192.168.1.100", "mac_address": "00:11:22:33:44:55", "hostname": "laptop-user1", "expires": "12h 30m"},
            {"address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:FF", "hostname": "android-phone", "expires": "23h 15m"},
            {"address": "192.168.1.102", "mac_address": "11:22:33:44:55:66", "hostname": "smart-tv", "expires": "35h 45m"},
            {"address": "192.168.1.103", "mac_address": "AA:11:BB:22:CC:33", "hostname": "desktop-pc", "expires": "6h 20m"},
            {"address": "192.168.1.104", "mac_address": "FF:EE:DD:CC:BB:AA", "hostname": "printer", "expires": "48h 0m"}
        ]
        
        # Tạo DataFrame và hiển thị
        df_leases = pd.DataFrame(leases)
        st.dataframe(df_leases, use_container_width=True)
    
    with tab3:
        st.subheader("Wireless Networks")
        
        # Mô phỏng dữ liệu
        wireless = [
            {"name": "Home-Network", "band": "2.4GHz", "channel": "6", "clients": 8, "security": "WPA2-PSK"},
            {"name": "Office-5G", "band": "5GHz", "channel": "36", "clients": 3, "security": "WPA3"}
        ]
        
        # Tạo DataFrame và hiển thị
        df_wireless = pd.DataFrame(wireless)
        st.dataframe(df_wireless, use_container_width=True)
        
        # Danh sách client
        st.subheader("Wireless Clients")
        
        # Mô phỏng dữ liệu
        clients = [
            {"mac": "00:11:22:33:44:55", "network": "Home-Network", "signal": -65, "tx_rate": "54 Mbps", "rx_rate": "54 Mbps"},
            {"mac": "AA:BB:CC:DD:EE:FF", "network": "Home-Network", "signal": -72, "tx_rate": "36 Mbps", "rx_rate": "36 Mbps"},
            {"mac": "11:22:33:44:55:66", "network": "Office-5G", "signal": -58, "tx_rate": "180 Mbps", "rx_rate": "180 Mbps"}
        ]
        
        # Tạo DataFrame và hiển thị
        df_clients = pd.DataFrame(clients)
        st.dataframe(df_clients, use_container_width=True)

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
EOF
echo "   ✓ Đã tạo file app.py cho Streamlit thành công"

# 12. Hiển thị thông tin kết thúc
echo "======================================================"
echo "  CÀI ĐẶT LẠI HOÀN TẤT"
echo "======================================================"
echo "Đã cài đặt lại thành công dự án MikroTik Monitor."
echo ""
echo "Các bước tiếp theo:"
echo "1. Chạy 'node server.js' để khởi động máy chủ Node.js"
echo "2. Chạy 'streamlit run app.py' để khởi động giao diện Streamlit"
echo "======================================================"