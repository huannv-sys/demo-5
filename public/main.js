document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const apiStatus = document.getElementById('api-status');
  const connectionsContainer = document.getElementById('connections');
  const routerForm = document.getElementById('router-form');
  const testApiBtn = document.getElementById('test-api');
  const apiResult = document.getElementById('api-result');
  const resultContainer = document.getElementById('result');
  
  // Check API status
  checkApiStatus();
  
  // Load connections
  loadConnections();
  
  // Event listeners
  routerForm.addEventListener('submit', handleRouterFormSubmit);
  testApiBtn.addEventListener('click', testApi);
  
  // Functions
  function checkApiStatus() {
    fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        apiStatus.innerHTML = `
          <div class="alert alert-success mb-0">
            <strong>API đang hoạt động!</strong><br>
            Thời gian: ${new Date(data.time).toLocaleString()}
          </div>
        `;
      })
      .catch(error => {
        apiStatus.innerHTML = `
          <div class="alert alert-danger mb-0">
            <strong>API không hoạt động!</strong><br>
            Lỗi: ${error.message}
          </div>
        `;
        console.error('Error checking API status:', error);
      });
  }
  
  function loadConnections() {
    fetch('/api/connections')
      .then(response => response.json())
      .then(connections => {
        if (connections.length === 0) {
          connectionsContainer.innerHTML = '<div class="text-muted">Chưa có thiết bị nào được thêm</div>';
          return;
        }
        
        connectionsContainer.innerHTML = '';
        connections.forEach(connection => {
          const item = document.createElement('div');
          item.className = 'connection-item';
          item.innerHTML = `
            <div>
              <div class="fw-bold">${connection.name}</div>
              <div class="small text-muted">${connection.address}:${connection.port}</div>
            </div>
            <div class="actions">
              <button class="btn btn-sm btn-success connect-btn" data-id="${connection.id}">Kết nối</button>
              <button class="btn btn-sm btn-danger delete-btn" data-id="${connection.id}">Xóa</button>
            </div>
          `;
          connectionsContainer.appendChild(item);
          
          // Add event listeners to buttons
          item.querySelector('.connect-btn').addEventListener('click', () => connectToRouter(connection.id));
          item.querySelector('.delete-btn').addEventListener('click', () => deleteConnection(connection.id));
        });
      })
      .catch(error => {
        connectionsContainer.innerHTML = `<div class="alert alert-danger">Lỗi: ${error.message}</div>`;
        console.error('Error loading connections:', error);
      });
  }
  
  function handleRouterFormSubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const address = document.getElementById('address').value;
    const port = document.getElementById('port').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isDefault = document.getElementById('isDefault').checked;
    
    const connectionData = {
      name,
      address,
      port: parseInt(port) || 8728,
      username,
      password,
      isDefault
    };
    
    showAlert('info', 'Đang kết nối đến router...', false);
    
    fetch('/api/connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(connectionData)
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(error => {
          throw new Error(error.message || 'Không thể kết nối đến router');
        });
      }
      return response.json();
    })
    .then(data => {
      showAlert('success', 'Đã thêm thiết bị thành công!');
      routerForm.reset();
      loadConnections();
      
      logToResult(`✅ Thiết bị đã được thêm thành công: ${data.name} (${data.address}:${data.port})`);
    })
    .catch(error => {
      showAlert('danger', `Lỗi: ${error.message}`);
      logToResult(`❌ Thêm thiết bị thất bại: ${error.message}`);
      console.error('Error adding router:', error);
    });
  }
  
  function connectToRouter(id) {
    showAlert('info', 'Đang kết nối đến router...', false);
    
    fetch(`/api/connections/${id}/connect`, {
      method: 'POST'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(error => {
          throw new Error(error.message || 'Không thể kết nối đến router');
        });
      }
      return response.json();
    })
    .then(data => {
      showAlert('success', data.message);
      logToResult(`✅ Kết nối thành công đến router ID: ${id}`);
      
      // Test getting resources
      getRouterResources(id);
    })
    .catch(error => {
      showAlert('danger', `Lỗi: ${error.message}`);
      logToResult(`❌ Kết nối thất bại: ${error.message}`);
      console.error('Error connecting to router:', error);
    });
  }
  
  function deleteConnection(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
      return;
    }
    
    fetch(`/api/connections/${id}`, {
      method: 'DELETE'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(error => {
          throw new Error(error.message || 'Không thể xóa thiết bị');
        });
      }
      return response.json();
    })
    .then(data => {
      showAlert('success', data.message || 'Đã xóa thiết bị');
      loadConnections();
      logToResult(`🗑️ Đã xóa thiết bị ID: ${id}`);
    })
    .catch(error => {
      showAlert('danger', `Lỗi: ${error.message}`);
      console.error('Error deleting connection:', error);
    });
  }
  
  function getRouterResources(id) {
    fetch(`/api/connections/${id}/resources`)
      .then(response => {
        if (!response.ok) {
          return response.json().then(error => {
            throw new Error(error.message || 'Không thể lấy thông tin tài nguyên');
          });
        }
        return response.json();
      })
      .then(resources => {
        logToResult(`📊 Thông tin tài nguyên của router:
- Platform: ${resources.platform}
- Board: ${resources.board}
- Version: ${resources.version}
- Uptime: ${resources.uptime}
- CPU Load: ${resources.cpuLoad}%
- Memory: ${formatBytes(resources.freeMemory)} / ${formatBytes(resources.totalMemory)}
- HDD: ${formatBytes(resources.freeHdd)} / ${formatBytes(resources.totalHdd)}
- Architecture: ${resources.architecture}
        `);
      })
      .catch(error => {
        logToResult(`❌ Lỗi khi lấy thông tin tài nguyên: ${error.message}`);
        console.error('Error getting resource info:', error);
      });
  }
  
  function testApi() {
    apiResult.innerHTML = '<div class="spinner-border text-info" role="status"><span class="visually-hidden">Loading...</span></div>';
    
    fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        apiResult.innerHTML = `
          <div class="alert alert-success">
            <strong>API đang hoạt động!</strong><br>
            Thời gian: ${new Date(data.time).toLocaleString()}
          </div>
        `;
      })
      .catch(error => {
        apiResult.innerHTML = `
          <div class="alert alert-danger">
            <strong>API không hoạt động!</strong><br>
            Lỗi: ${error.message}
          </div>
        `;
        console.error('Error testing API:', error);
      });
  }
  
  function showAlert(type, message, autoClose = true) {
    const alertContainer = document.getElementById('alert-container');
    const alertId = 'alert-' + Date.now();
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.setAttribute('role', 'alert');
    alertElement.id = alertId;
    alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.appendChild(alertElement);
    
    if (autoClose) {
      setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
          const bsAlert = new bootstrap.Alert(alert);
          bsAlert.close();
        }
      }, 5000);
    }
    
    return alertId;
  }
  
  function logToResult(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<div class="text-muted small">[${timestamp}]</div>
                         <div class="log-message">${message}</div>`;
    
    resultContainer.appendChild(logEntry);
    resultContainer.scrollTop = resultContainer.scrollHeight;
  }
  
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
});