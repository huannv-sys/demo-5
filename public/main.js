// MikroTik Controller - JavaScript Client

// Các biến toàn cục
let selectedRouterId = null;
let isConnected = false;

// Hàm khởi tạo khi tài liệu đã sẵn sàng
document.addEventListener('DOMContentLoaded', function() {
  // Đăng ký các sự kiện
  document.getElementById('btn-refresh').addEventListener('click', refreshData);
  document.getElementById('btn-connect').addEventListener('click', connectToSelectedRouter);
  document.getElementById('btn-disconnect').addEventListener('click', disconnectFromSelectedRouter);
  document.getElementById('btn-save-router').addEventListener('click', handleRouterFormSubmit);
  document.getElementById('btn-clear-logs').addEventListener('click', clearResultArea);
  
  // Tab điều hướng
  document.querySelectorAll('.nav-link').forEach(tab => {
    tab.addEventListener('click', function() {
      if (tab.id === 'dashboard-tab' || tab.id === 'interfaces-tab') {
        // Chỉ tải dữ liệu khi chuyển sang tab cần dữ liệu
        if (isConnected) {
          if (tab.id === 'dashboard-tab') {
            getRouterResources(selectedRouterId);
          } else if (tab.id === 'interfaces-tab') {
            loadInterfaces(selectedRouterId);
          }
        }
      }
    });
  });
  
  // Kiểm tra trạng thái API
  checkApiStatus();
  
  // Tải danh sách kết nối
  loadConnections();
  
  // Hiển thị thông báo chào mừng
  logToResult('🚀 MikroTik Controller đã khởi động');
  logToResult('Hãy kết nối đến thiết bị MikroTik để bắt đầu...');
});

// Kiểm tra trạng thái API
function checkApiStatus() {
  fetch('/api/status')
    .then(response => response.json())
    .then(data => {
      logToResult(`✓ API sẵn sàng (${data.time})`);
    })
    .catch(error => {
      showAlert('danger', 'Không thể kết nối đến API. Vui lòng làm mới trang.');
      logToResult('❌ Lỗi kết nối API: ' + error.message);
    });
}

// Tải danh sách kết nối
function loadConnections() {
  fetch('/api/connections')
    .then(response => response.json())
    .then(connections => {
      const tbody = document.querySelector('#connections-table tbody');
      tbody.innerHTML = '';
      
      if (connections.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Không có thiết bị nào. Hãy thêm thiết bị mới.</td></tr>';
        return;
      }
      
      connections.forEach(conn => {
        const row = document.createElement('tr');
        
        // ID
        const idCell = document.createElement('td');
        idCell.textContent = conn.id;
        row.appendChild(idCell);
        
        // Tên
        const nameCell = document.createElement('td');
        nameCell.textContent = conn.name;
        row.appendChild(nameCell);
        
        // Địa chỉ
        const addressCell = document.createElement('td');
        addressCell.textContent = conn.address;
        row.appendChild(addressCell);
        
        // Cổng
        const portCell = document.createElement('td');
        portCell.textContent = conn.port;
        row.appendChild(portCell);
        
        // Tên đăng nhập
        const usernameCell = document.createElement('td');
        usernameCell.textContent = conn.username;
        row.appendChild(usernameCell);
        
        // Mặc định
        const defaultCell = document.createElement('td');
        defaultCell.innerHTML = conn.isDefault ? 
          '<span class="badge bg-success"><i class="fas fa-check"></i></span>' : 
          '<span class="badge bg-secondary"><i class="fas fa-times"></i></span>';
        row.appendChild(defaultCell);
        
        // Trạng thái
        const statusCell = document.createElement('td');
        statusCell.innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
        row.appendChild(statusCell);
        
        // Thao tác
        const actionCell = document.createElement('td');
        actionCell.classList.add('d-flex', 'gap-1');
        
        // Nút kết nối
        const connectBtn = document.createElement('button');
        connectBtn.classList.add('btn', 'btn-sm', 'btn-success');
        connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
        connectBtn.title = 'Kết nối';
        connectBtn.addEventListener('click', () => connectToRouter(conn.id));
        actionCell.appendChild(connectBtn);
        
        // Nút xóa
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('btn', 'btn-sm', 'btn-danger');
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.title = 'Xóa';
        deleteBtn.addEventListener('click', () => deleteConnection(conn.id));
        actionCell.appendChild(deleteBtn);
        
        row.appendChild(actionCell);
        
        // Thêm hàng vào bảng
        tbody.appendChild(row);
        
        // Nếu đây là thiết bị mặc định, chọn nó
        if (conn.isDefault && !selectedRouterId) {
          selectedRouterId = conn.id;
          document.getElementById('resource-subtitle').textContent = `Router: ${conn.name} (${conn.address}:${conn.port})`;
        }
      });
      
      // Nếu đã chọn router, kiểm tra trạng thái kết nối
      if (selectedRouterId) {
        checkConnectionStatus(selectedRouterId);
      }
    })
    .catch(error => {
      showAlert('danger', 'Không thể tải danh sách thiết bị.');
      logToResult('❌ Lỗi tải danh sách thiết bị: ' + error.message);
    });
}

// Xử lý gửi form thêm router
function handleRouterFormSubmit(event) {
  event.preventDefault();
  
  const name = document.getElementById('router-name').value.trim();
  const address = document.getElementById('router-address').value.trim();
  const port = document.getElementById('router-port').value;
  const username = document.getElementById('router-username').value.trim();
  const password = document.getElementById('router-password').value;
  const isDefault = document.getElementById('router-default').checked;
  
  // Kiểm tra dữ liệu đầu vào
  if (!name || !address || !username || !password) {
    showAlert('danger', 'Vui lòng điền đầy đủ thông tin.');
    return;
  }
  
  // Hiển thị trạng thái đang xử lý
  document.getElementById('btn-save-router').disabled = true;
  document.getElementById('btn-save-router').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
  
  // Gửi dữ liệu
  fetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, address, port, username, password, isDefault })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể thêm thiết bị. Vui lòng kiểm tra thông tin kết nối.');
    }
    return response.json();
  })
  .then(data => {
    // Đóng modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('router-modal'));
    modal.hide();
    
    // Hiển thị thông báo thành công
    showAlert('success', 'Đã thêm thiết bị thành công!');
    logToResult(`✓ Đã thêm thiết bị: ${name} (${address}:${port})`);
    
    // Làm mới danh sách kết nối
    loadConnections();
    
    // Xóa form
    document.getElementById('router-form').reset();
  })
  .catch(error => {
    showAlert('danger', error.message);
    logToResult('❌ Lỗi thêm thiết bị: ' + error.message);
  })
  .finally(() => {
    // Khôi phục nút
    document.getElementById('btn-save-router').disabled = false;
    document.getElementById('btn-save-router').innerHTML = '<i class="fas fa-save me-1"></i> Lưu';
  });
}

// Kết nối đến router
function connectToRouter(id) {
  if (!id) {
    showAlert('warning', 'Vui lòng chọn thiết bị trước.');
    return;
  }
  
  // Cập nhật UI
  document.getElementById('btn-connect').disabled = true;
  document.getElementById('btn-connect').innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Đang kết nối...';
  
  // Gửi yêu cầu kết nối
  fetch(`/api/connections/${id}/connect`, {
    method: 'POST'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể kết nối đến thiết bị. Vui lòng kiểm tra thông tin kết nối.');
    }
    return response.json();
  })
  .then(data => {
    selectedRouterId = id;
    isConnected = true;
    
    // Cập nhật UI
    document.getElementById('btn-connect').disabled = false;
    document.getElementById('btn-connect').innerHTML = '<i class="fas fa-plug me-1"></i> Kết nối';
    document.getElementById('btn-disconnect').disabled = false;
    
    document.getElementById('connection-status').innerHTML = '<span class="badge bg-success">Đã kết nối</span>';
    
    // Cập nhật trạng thái trong bảng
    updateConnectionStatusInTable(id, true);
    
    // Hiển thị thông báo thành công
    showAlert('success', 'Đã kết nối thành công!');
    logToResult(`✓ Đã kết nối đến router ID: ${id}`);
    
    // Tải thông tin router
    getRouterResources(id);
  })
  .catch(error => {
    // Cập nhật UI
    document.getElementById('btn-connect').disabled = false;
    document.getElementById('btn-connect').innerHTML = '<i class="fas fa-plug me-1"></i> Kết nối';
    
    showAlert('danger', error.message);
    logToResult('❌ Lỗi kết nối: ' + error.message);
  });
}

// Cập nhật trạng thái kết nối trong bảng
function updateConnectionStatusInTable(id, connected) {
  const rows = document.querySelectorAll('#connections-table tbody tr');
  
  rows.forEach(row => {
    const rowId = row.querySelector('td:first-child').textContent;
    if (rowId == id) {
      const statusCell = row.querySelector('td:nth-child(7)');
      statusCell.innerHTML = connected ? 
        '<span class="badge bg-success">Đã kết nối</span>' : 
        '<span class="badge bg-secondary">Chưa kết nối</span>';
    } else {
      // Đặt các hàng khác về trạng thái không kết nối
      const statusCell = row.querySelector('td:nth-child(7)');
      statusCell.innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
    }
  });
}

// Kiểm tra trạng thái kết nối
function checkConnectionStatus(id) {
  if (!id) return;
  
  fetch(`/api/connections/${id}/resources`)
    .then(response => {
      if (response.ok) {
        isConnected = true;
        selectedRouterId = id;
        
        // Cập nhật UI
        document.getElementById('btn-disconnect').disabled = false;
        document.getElementById('connection-status').innerHTML = '<span class="badge bg-success">Đã kết nối</span>';
        
        // Cập nhật trạng thái trong bảng
        updateConnectionStatusInTable(id, true);
        
        return response.json();
      } else {
        isConnected = false;
        throw new Error('Không có kết nối đến thiết bị.');
      }
    })
    .then(data => {
      // Hiển thị dữ liệu
      displayResourceInfo(data);
    })
    .catch(error => {
      // Không hiển thị lỗi, chỉ đặt trạng thái
      document.getElementById('btn-disconnect').disabled = true;
      document.getElementById('connection-status').innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
    });
}

// Ngắt kết nối đến router
function disconnectFromSelectedRouter() {
  if (!selectedRouterId) {
    showAlert('warning', 'Không có thiết bị nào được chọn.');
    return;
  }
  
  // Cập nhật UI
  document.getElementById('btn-disconnect').disabled = true;
  document.getElementById('btn-disconnect').innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Đang ngắt kết nối...';
  
  fetch(`/api/connections/${selectedRouterId}/connect`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể ngắt kết nối.');
    }
    return response.json();
  })
  .then(data => {
    isConnected = false;
    
    // Cập nhật UI
    document.getElementById('btn-disconnect').disabled = true;
    document.getElementById('btn-disconnect').innerHTML = '<i class="fas fa-power-off me-1"></i> Ngắt kết nối';
    
    document.getElementById('connection-status').innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
    
    // Cập nhật trạng thái trong bảng
    updateConnectionStatusInTable(selectedRouterId, false);
    
    // Xóa các card tài nguyên
    document.getElementById('resource-cards').innerHTML = `
      <div class="col-md-3 mb-3">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">
              <i class="fas fa-info-circle text-primary me-2"></i> Trạng thái
            </h5>
            <p class="card-text fs-4 text-center" id="connection-status">
              <span class="badge bg-secondary">Chưa kết nối</span>
            </p>
          </div>
        </div>
      </div>
    `;
    
    // Xóa thông tin chi tiết
    document.getElementById('resource-details').innerHTML = '';
    
    // Xóa bảng interfaces
    document.querySelector('#interfaces-table tbody').innerHTML = '';
    
    // Hiển thị thông báo thành công
    showAlert('success', 'Đã ngắt kết nối thành công!');
    logToResult(`✓ Đã ngắt kết nối khỏi router ID: ${selectedRouterId}`);
  })
  .catch(error => {
    // Cập nhật UI
    document.getElementById('btn-disconnect').disabled = false;
    document.getElementById('btn-disconnect').innerHTML = '<i class="fas fa-power-off me-1"></i> Ngắt kết nối';
    
    showAlert('danger', error.message);
    logToResult('❌ Lỗi ngắt kết nối: ' + error.message);
  });
}

// Lấy thông tin tài nguyên
function getRouterResources(id) {
  if (!id) {
    showAlert('warning', 'Vui lòng chọn thiết bị trước.');
    return;
  }
  
  fetch(`/api/connections/${id}/resources`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Không thể lấy thông tin tài nguyên. Vui lòng kết nối lại.');
      }
      return response.json();
    })
    .then(data => {
      // Hiển thị dữ liệu
      displayResourceInfo(data);
      
      // Hiển thị thông báo thành công
      logToResult(`✓ Đã tải thông tin tài nguyên của router ID: ${id}`);
      
      // Đánh dấu đã kết nối
      isConnected = true;
      document.getElementById('btn-disconnect').disabled = false;
      document.getElementById('connection-status').innerHTML = '<span class="badge bg-success">Đã kết nối</span>';
      
      // Cập nhật trạng thái trong bảng
      updateConnectionStatusInTable(id, true);
    })
    .catch(error => {
      showAlert('danger', error.message);
      logToResult('❌ Lỗi tải thông tin tài nguyên: ' + error.message);
      
      // Đánh dấu đã ngắt kết nối
      isConnected = false;
      document.getElementById('btn-disconnect').disabled = true;
      document.getElementById('connection-status').innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
      
      // Cập nhật trạng thái trong bảng
      updateConnectionStatusInTable(id, false);
    });
}

// Hiển thị thông tin tài nguyên
function displayResourceInfo(data) {
  // Tạo các card tài nguyên
  const resourceCards = document.getElementById('resource-cards');
  
  // Card trạng thái kết nối
  let cardsHTML = `
    <div class="col-md-3 mb-3">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">
            <i class="fas fa-info-circle text-primary me-2"></i> Trạng thái
          </h5>
          <p class="card-text fs-4 text-center" id="connection-status">
            <span class="badge bg-success">Đã kết nối</span>
          </p>
        </div>
        <div class="card-footer text-center">
          <small class="text-muted">${data.platform} ${data.board}</small>
        </div>
      </div>
    </div>
  `;
  
  // Card CPU
  cardsHTML += `
    <div class="col-md-3 mb-3">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">
            <i class="fas fa-microchip text-danger me-2"></i> CPU
          </h5>
          <p class="card-text text-center">
            <span class="stat-value">${data.cpuLoad}%</span>
          </p>
          <div class="progress">
            <div class="progress-bar bg-danger" role="progressbar" style="width: ${data.cpuLoad}%" 
                aria-valuenow="${data.cpuLoad}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </div>
        <div class="card-footer text-center">
          <small class="text-muted">${data.architecture || 'Unknown'}</small>
        </div>
      </div>
    </div>
  `;
  
  // Card RAM
  const memoryUsed = data.totalMemory - data.freeMemory;
  const memoryPercent = Math.round((memoryUsed / data.totalMemory) * 100);
  
  cardsHTML += `
    <div class="col-md-3 mb-3">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">
            <i class="fas fa-memory text-success me-2"></i> Bộ nhớ (RAM)
          </h5>
          <p class="card-text text-center">
            <span class="stat-value">${memoryPercent}%</span>
          </p>
          <div class="progress">
            <div class="progress-bar bg-success" role="progressbar" style="width: ${memoryPercent}%" 
                aria-valuenow="${memoryPercent}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </div>
        <div class="card-footer text-center">
          <small class="text-muted">${formatBytes(memoryUsed)} / ${formatBytes(data.totalMemory)}</small>
        </div>
      </div>
    </div>
  `;
  
  // Card Uptime
  cardsHTML += `
    <div class="col-md-3 mb-3">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">
            <i class="fas fa-clock text-info me-2"></i> Thời gian hoạt động
          </h5>
          <p class="card-text text-center">
            <span class="stat-value">${formatUptime(data.uptime)}</span>
          </p>
        </div>
        <div class="card-footer text-center">
          <small class="text-muted">RouterOS v${data.version || 'Unknown'}</small>
        </div>
      </div>
    </div>
  `;
  
  // Cập nhật UI
  resourceCards.innerHTML = cardsHTML;
  
  // Hiển thị thông tin chi tiết
  const resourceDetails = document.getElementById('resource-details');
  
  resourceDetails.innerHTML = `
    <div class="resource-detail-section">
      <h5><i class="fas fa-server me-2"></i>Thông tin hệ thống</h5>
      <div class="row">
        <div class="col-md-6">
          <table class="table table-sm">
            <tr>
              <td><strong>Platform</strong></td>
              <td>${data.platform || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Board</strong></td>
              <td>${data.board || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>RouterOS Version</strong></td>
              <td>${data.version || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Architecture</strong></td>
              <td>${data.architecture || 'N/A'}</td>
            </tr>
          </table>
        </div>
        <div class="col-md-6">
          <table class="table table-sm">
            <tr>
              <td><strong>CPU Load</strong></td>
              <td>${data.cpuLoad}%</td>
            </tr>
            <tr>
              <td><strong>Total Memory</strong></td>
              <td>${formatBytes(data.totalMemory)}</td>
            </tr>
            <tr>
              <td><strong>Free Memory</strong></td>
              <td>${formatBytes(data.freeMemory)}</td>
            </tr>
            <tr>
              <td><strong>Uptime</strong></td>
              <td>${data.uptime}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Tải danh sách interfaces
  loadInterfaces(selectedRouterId);
}

// Tải danh sách giao diện mạng
function loadInterfaces(id) {
  if (!id) return;
  
  fetch(`/api/connections/${id}/interfaces`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Không thể tải danh sách interfaces.');
      }
      return response.json();
    })
    .then(interfaces => {
      const tbody = document.querySelector('#interfaces-table tbody');
      tbody.innerHTML = '';
      
      if (interfaces.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Không có interfaces nào.</td></tr>';
        return;
      }
      
      interfaces.forEach(iface => {
        const row = document.createElement('tr');
        
        // Tên
        const nameCell = document.createElement('td');
        nameCell.textContent = iface.name;
        row.appendChild(nameCell);
        
        // Loại
        const typeCell = document.createElement('td');
        typeCell.textContent = iface.type || 'N/A';
        row.appendChild(typeCell);
        
        // MTU
        const mtuCell = document.createElement('td');
        mtuCell.textContent = iface.mtu || 'N/A';
        row.appendChild(mtuCell);
        
        // Actual MTU
        const actualMtuCell = document.createElement('td');
        actualMtuCell.textContent = iface.actualMtu || 'N/A';
        row.appendChild(actualMtuCell);
        
        // MAC Address
        const macCell = document.createElement('td');
        macCell.textContent = iface.macAddress || 'N/A';
        row.appendChild(macCell);
        
        // Trạng thái
        const statusCell = document.createElement('td');
        let statusBadge = '';
        
        if (iface.disabled) {
          statusBadge = '<span class="badge bg-secondary">Disabled</span>';
        } else if (iface.running) {
          statusBadge = '<span class="badge bg-success">Running</span>';
        } else {
          statusBadge = '<span class="badge bg-danger">Down</span>';
        }
        
        statusCell.innerHTML = statusBadge;
        row.appendChild(statusCell);
        
        // Ghi chú
        const commentCell = document.createElement('td');
        commentCell.textContent = iface.comment || '';
        row.appendChild(commentCell);
        
        // Thêm hàng vào bảng
        tbody.appendChild(row);
      });
      
      // Hiển thị thông báo thành công
      logToResult(`✓ Đã tải ${interfaces.length} interfaces từ router ID: ${id}`);
    })
    .catch(error => {
      document.querySelector('#interfaces-table tbody').innerHTML = 
        '<tr><td colspan="7" class="text-center text-danger">Không thể tải danh sách interfaces.</td></tr>';
      
      logToResult('❌ Lỗi tải interfaces: ' + error.message);
    });
}

// Xóa kết nối
function deleteConnection(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
    return;
  }
  
  fetch(`/api/connections/${id}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Không thể xóa thiết bị.');
    }
    return response.json();
  })
  .then(data => {
    showAlert('success', 'Đã xóa thiết bị thành công!');
    logToResult(`✓ Đã xóa thiết bị ID: ${id}`);
    
    // Nếu đang chọn router bị xóa, đặt lại biến
    if (selectedRouterId === id) {
      selectedRouterId = null;
      isConnected = false;
      document.getElementById('btn-disconnect').disabled = true;
      document.getElementById('connection-status').innerHTML = '<span class="badge bg-secondary">Chưa kết nối</span>';
    }
    
    // Làm mới danh sách kết nối
    loadConnections();
  })
  .catch(error => {
    showAlert('danger', error.message);
    logToResult('❌ Lỗi xóa thiết bị: ' + error.message);
  });
}

// Làm mới dữ liệu
function refreshData() {
  // Hiệu ứng quay cho nút refresh
  const refreshBtn = document.getElementById('btn-refresh');
  refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin me-1"></i> Đang làm mới...';
  refreshBtn.disabled = true;
  
  // Làm mới danh sách kết nối
  loadConnections();
  
  // Nếu đã kết nối, làm mới thông tin tài nguyên
  if (isConnected && selectedRouterId) {
    getRouterResources(selectedRouterId);
  }
  
  // Khôi phục nút sau 1 giây
  setTimeout(() => {
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Làm mới';
    refreshBtn.disabled = false;
  }, 1000);
}

// Kết nối đến router đã chọn
function connectToSelectedRouter() {
  if (!selectedRouterId) {
    showAlert('warning', 'Vui lòng chọn thiết bị trong tab "Kết nối thiết bị".');
    return;
  }
  
  connectToRouter(selectedRouterId);
}

// Hàm hiển thị thông báo
function showAlert(type, message, autoClose = true) {
  const alertContainer = document.getElementById('alert-container');
  
  // Tạo phần tử alert
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Thêm vào container
  alertContainer.appendChild(alertDiv);
  
  // Tự động đóng sau 5 giây
  if (autoClose) {
    setTimeout(() => {
      alertDiv.classList.remove('show');
      setTimeout(() => {
        alertDiv.remove();
      }, 150);
    }, 5000);
  }
}

// Ghi nhật ký vào khu vực kết quả
function logToResult(message) {
  const resultArea = document.getElementById('result');
  const timestamp = new Date().toLocaleTimeString();
  
  resultArea.innerHTML += `[${timestamp}] ${message}\n`;
  
  // Cuộn xuống dưới
  resultArea.scrollTop = resultArea.scrollHeight;
}

// Xóa khu vực kết quả
function clearResultArea() {
  document.getElementById('result').innerHTML = '';
}

// Định dạng byte thành KB, MB, GB...
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Định dạng chuỗi uptime
function formatUptime(uptime) {
  // Đơn giản hóa uptime từ RouterOS (ví dụ: từ "1w2d3h4m5s" thành "1w 2d 3h")
  // Giữ nguyên nếu không cần xử lý phức tạp
  return uptime;
}