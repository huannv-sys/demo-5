#!/bin/bash

# Nếu đang chạy trong nền, chỉ cần chạy các dịch vụ
if [ "$1" == "background" ]; then
    # Khởi động Node.js API server
    node server.js > /dev/null 2>&1 &
    echo $! > server.pid
    
    # Khởi động Streamlit UI
    streamlit run app.py --server.port=5000 > /dev/null 2>&1 &
    echo $! > streamlit.pid
    
    exit 0
fi

# Nếu chạy trong terminal, hiển thị menu
echo "==================================================="
echo "         MikroTik Monitor - Khởi động              "
echo "==================================================="
echo ""
echo "1. Khởi động đầy đủ (API + Web UI)"
echo "2. Chỉ khởi động API (Node.js)"
echo "3. Chỉ khởi động Web UI (Streamlit)"
echo "4. Chạy tất cả trong nền"
echo "5. Thoát"
echo ""
read -p "Lựa chọn của bạn [1-5]: " choice

case $choice in
    1)
        # Khởi động cả API và Web UI trong terminal hiện tại
        ./run_server.sh
        ;;
    2)
        # Chỉ khởi động API
        echo "Khởi động Node.js API server..."
        node server.js
        ;;
    3)
        # Chỉ khởi động Web UI
        echo "Khởi động Streamlit Web UI..."
        streamlit run app.py --server.port=5000
        ;;
    4)
        # Chạy trong nền
        echo "Khởi động tất cả dịch vụ trong nền..."
        $0 background
        echo "Các dịch vụ đã được khởi động trong nền."
        echo "Sử dụng 'ps aux | grep node' hoặc 'ps aux | grep streamlit' để kiểm tra."
        ;;
    5)
        echo "Thoát."
        exit 0
        ;;
    *)
        echo "Lựa chọn không hợp lệ. Vui lòng chạy lại script."
        exit 1
        ;;
esac