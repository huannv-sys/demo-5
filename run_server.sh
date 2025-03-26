#!/bin/bash

# Script chạy đồng thời Node.js và Streamlit
echo "Starting MikroTik Monitor..."

# Kiểm tra port 3000 (Node.js) và 5000 (Streamlit)
check_port() {
    nc -z localhost $1 > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "Port $1 is already in use. Please close the application using this port."
        exit 1
    fi
}

check_port 3000
check_port 5000

# Đảm bảo thư mục logs tồn tại
mkdir -p logs

# Xóa các file pid cũ nếu có
rm -f server.pid streamlit.pid

# Khởi động Node.js API server
echo "Starting Node.js API server on port 3000..."
node server.js > logs/node.log 2>&1 &
NODE_PID=$!
echo $NODE_PID > server.pid
echo "Node.js server started with PID $NODE_PID"

# Khởi động Streamlit UI
echo "Starting Streamlit UI on port 5000..."
streamlit run app.py --server.port=5000 > logs/streamlit.log 2>&1 &
STREAMLIT_PID=$!
echo $STREAMLIT_PID > streamlit.pid
echo "Streamlit UI started with PID $STREAMLIT_PID"

echo "MikroTik Monitor is running."
echo "- API server: http://localhost:3000"
echo "- Web UI: http://localhost:5000"
echo ""
echo "To stop the servers, run: ./stop_server.sh"