document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const statusIndicator = document.getElementById('status-indicator');
  const connectionForm = document.getElementById('connection-form');
  const routerForm = document.getElementById('router-form');
  const cancelConnectBtn = document.getElementById('cancel-connect');
  const mainContent = document.getElementById('main-content');
  
  // Navigation
  const navLinks = document.querySelectorAll('.sidebar nav a');
  const sections = document.querySelectorAll('.section');
  
  // State
  let isConnected = false;
  let refreshIntervals = {};
  
  // Event listeners
  connectBtn.addEventListener('click', showConnectionForm);
  disconnectBtn.addEventListener('click', disconnectFromRouter);
  routerForm.addEventListener('submit', handleRouterFormSubmit);
  cancelConnectBtn.addEventListener('click', hideConnectionForm);
  
  // Refresh buttons
  document.querySelectorAll('.refresh-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const target = this.dataset.target;
      refreshData(target);
    });
  });
  
  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      if (this.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        
        // Remove active class from all links and sections
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        // Add active class to clicked link
        this.classList.add('active');
        
        // Show corresponding section
        const targetSection = document.querySelector(this.getAttribute('href'));
        if (targetSection) {
          targetSection.classList.add('active');
        }
      }
    });
  });

  // Check initial connection status
  checkConnectionStatus();
  
  // Functions
  function showConnectionForm() {
    connectionForm.style.display = 'block';
  }
  
  function hideConnectionForm() {
    connectionForm.style.display = 'none';
  }
  
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  function checkConnectionStatus() {
    fetch('/api/router/status')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.connected) {
          updateConnectionStatus(true);
        } else {
          updateConnectionStatus(false);
        }
      })
      .catch(error => {
        console.error('Error checking connection status:', error);
        updateConnectionStatus(false);
      });
  }
  
  function updateConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
      statusIndicator.textContent = 'Đã kết nối';
      statusIndicator.classList.add('connected');
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      mainContent.style.display = 'flex';
      loadAllData();
      setupRefreshIntervals();
    } else {
      statusIndicator.textContent = 'Chưa kết nối';
      statusIndicator.classList.remove('connected');
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
      mainContent.style.display = 'none';
      clearAllRefreshIntervals();
    }
  }
  
  function handleRouterFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(routerForm);
    const routerData = {
      address: formData.get('address'),
      port: formData.get('port'),
      username: formData.get('username'),
      password: formData.get('password')
    };
    
    connectToRouter(routerData);
  }
  
  function connectToRouter(routerData) {
    fetch('/api/router/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(routerData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('Kết nối thành công!', 'success');
        hideConnectionForm();
        updateConnectionStatus(true);
      } else {
        showToast(`Lỗi kết nối: ${data.message}`, 'error');
        updateConnectionStatus(false);
      }
    })
    .catch(error => {
      console.error('Error connecting to router:', error);
      showToast('Lỗi kết nối đến router', 'error');
      updateConnectionStatus(false);
    });
  }
  
  function disconnectFromRouter() {
    fetch('/api/router/disconnect', {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showToast('Đã ngắt kết nối', 'info');
        updateConnectionStatus(false);
      } else {
        showToast(`Lỗi khi ngắt kết nối: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error('Error disconnecting from router:', error);
      showToast('Lỗi khi ngắt kết nối', 'error');
    });
  }
  
  function loadAllData() {
    refreshData('status');
    refreshData('interfaces');
    refreshData('access-points');
    refreshData('clients');
    refreshData('configurations');
    refreshData('channels');
    refreshData('security');
    refreshData('aps-summary');
    refreshData('clients-summary');
  }
  
  function refreshData(target) {
    switch(target) {
      case 'status':
        // Tạm thời hiển thị
        document.getElementById('status-container').innerHTML = `
          <div class="status-info">
            <div class="info-item">
              <span class="info-label">Trạng thái:</span>
              <span class="info-value">Đang hoạt động</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phiên bản:</span>
              <span class="info-value">RouterOS 7.x</span>
            </div>
          </div>
        `;
        break;
        
      case 'interfaces':
        fetchCapsmanData('/api/router/capsman/interfaces', 'interfaces-container', renderInterfacesTable);
        break;
        
      case 'access-points':
        fetchCapsmanData('/api/router/capsman/access-points', 'access-points-container', renderAccessPointsTable);
        break;
        
      case 'clients':
        fetchCapsmanData('/api/router/capsman/clients', 'clients-container', renderClientsTable);
        break;
        
      case 'configurations':
        fetchCapsmanData('/api/router/capsman/configurations', 'configurations-container', renderConfigurationsTable);
        break;
        
      case 'channels':
        fetchCapsmanData('/api/router/capsman/channels', 'channels-container', renderChannelsTable);
        break;
        
      case 'security':
        fetchCapsmanData('/api/router/capsman/security', 'security-container', renderSecurityTable);
        break;
        
      case 'aps-summary':
        fetchCapsmanData('/api/router/capsman/access-points', 'aps-summary-container', renderAPsSummary);
        break;
        
      case 'clients-summary':
        fetchCapsmanData('/api/router/capsman/clients', 'clients-summary-container', renderClientsSummary);
        break;
    }
  }
  
  function fetchCapsmanData(url, containerId, renderFunction) {
    const container = document.getElementById(containerId);
    container.innerHTML = '<div class="loading">Đang tải...</div>';
    
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          renderFunction(data.data, container);
        } else {
          container.innerHTML = `<div class="error-message">${data.message || 'Không thể tải dữ liệu'}</div>`;
        }
      })
      .catch(error => {
        console.error(`Error fetching data from ${url}:`, error);
        container.innerHTML = '<div class="error-message">Lỗi khi tải dữ liệu</div>';
      });
  }
  
  function renderInterfacesTable(interfaces, container) {
    if (!interfaces || interfaces.length === 0) {
      container.innerHTML = '<div class="no-data">Không có interface CAPsMAN nào</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>SSID</th>
          <th>MAC Address</th>
          <th>Kênh</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${interfaces.map(iface => `
          <tr>
            <td>${iface.name || '-'}</td>
            <td>${iface.ssid || '-'}</td>
            <td>${iface['mac-address'] || '-'}</td>
            <td>${iface.channel || '-'}</td>
            <td>
              <span class="status-badge ${iface.disabled === 'true' ? 'inactive' : 'active'}">
                ${iface.disabled === 'true' ? 'Vô hiệu hóa' : 'Hoạt động'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderAccessPointsTable(accessPoints, container) {
    if (!accessPoints || accessPoints.length === 0) {
      container.innerHTML = '<div class="no-data">Không có access point nào được đăng ký</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>MAC Address</th>
          <th>Địa chỉ IP</th>
          <th>Radio MAC</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${accessPoints.map(ap => `
          <tr>
            <td>${ap.name || '-'}</td>
            <td>${ap['mac-address'] || '-'}</td>
            <td>${ap.address || '-'}</td>
            <td>${ap['radio-mac'] || '-'}</td>
            <td>
              <span class="status-badge ${ap.status === 'connected' ? 'active' : 'inactive'}">
                ${ap.status || 'Unknown'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderClientsTable(clients, container) {
    if (!clients || clients.length === 0) {
      container.innerHTML = '<div class="no-data">Không có client nào kết nối</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>MAC Address</th>
          <th>Interface</th>
          <th>SSID</th>
          <th>Signal</th>
          <th>TX/RX Rate</th>
          <th>Uptime</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map(client => `
          <tr>
            <td>${client['mac-address'] || '-'}</td>
            <td>${client.interface || '-'}</td>
            <td>${client.ssid || '-'}</td>
            <td>${client['signal-strength'] || '-'} dBm</td>
            <td>${client['tx-rate'] || '-'} / ${client['rx-rate'] || '-'}</td>
            <td>${client.uptime || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderConfigurationsTable(configurations, container) {
    if (!configurations || configurations.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình nào</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>SSID</th>
          <th>Kênh</th>
          <th>Bảo mật</th>
          <th>Datapath</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${configurations.map(config => `
          <tr>
            <td>${config.name || '-'}</td>
            <td>${config.ssid || '-'}</td>
            <td>${config.channel || '-'}</td>
            <td>${config.security || '-'}</td>
            <td>${config.datapath || '-'}</td>
            <td>
              <span class="status-badge ${config.disabled === 'true' ? 'inactive' : 'active'}">
                ${config.disabled === 'true' ? 'Vô hiệu hóa' : 'Hoạt động'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderChannelsTable(channels, container) {
    if (!channels || channels.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình kênh nào</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>Tần số</th>
          <th>Độ rộng</th>
          <th>Band</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${channels.map(channel => `
          <tr>
            <td>${channel.name || '-'}</td>
            <td>${channel.frequency || '-'}</td>
            <td>${channel['width'] || '-'}</td>
            <td>${channel.band || '-'}</td>
            <td>
              <span class="status-badge ${channel.disabled === 'true' ? 'inactive' : 'active'}">
                ${channel.disabled === 'true' ? 'Vô hiệu hóa' : 'Hoạt động'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderSecurityTable(securityConfigs, container) {
    if (!securityConfigs || securityConfigs.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình bảo mật nào</div>';
      return;
    }
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Tên</th>
          <th>Phương thức xác thực</th>
          <th>Mã hóa</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${securityConfigs.map(security => `
          <tr>
            <td>${security.name || '-'}</td>
            <td>${security.authentication || '-'}</td>
            <td>${security.encryption || '-'}</td>
            <td>
              <span class="status-badge ${security.disabled === 'true' ? 'inactive' : 'active'}">
                ${security.disabled === 'true' ? 'Vô hiệu hóa' : 'Hoạt động'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
  }
  
  function renderAPsSummary(accessPoints, container) {
    if (!accessPoints || accessPoints.length === 0) {
      container.innerHTML = '<div class="no-data">Không có access point nào được đăng ký</div>';
      return;
    }
    
    // Đếm số lượng AP theo trạng thái
    const connectedAPs = accessPoints.filter(ap => ap.status === 'connected').length;
    const totalAPs = accessPoints.length;
    
    container.innerHTML = `
      <div class="summary-info">
        <div class="summary-item">
          <span class="value">${totalAPs}</span>
          <span class="label">Tổng số</span>
        </div>
        <div class="summary-item">
          <span class="value">${connectedAPs}</span>
          <span class="label">Đang hoạt động</span>
        </div>
        <div class="summary-item">
          <span class="value">${totalAPs - connectedAPs}</span>
          <span class="label">Không hoạt động</span>
        </div>
      </div>
    `;
  }
  
  function renderClientsSummary(clients, container) {
    if (!clients || clients.length === 0) {
      container.innerHTML = '<div class="no-data">Không có client nào kết nối</div>';
      return;
    }
    
    // Nhóm theo SSID
    const ssidGroups = {};
    clients.forEach(client => {
      const ssid = client.ssid || 'Unknown';
      if (!ssidGroups[ssid]) {
        ssidGroups[ssid] = 0;
      }
      ssidGroups[ssid]++;
    });
    
    let summaryHTML = `
      <div class="summary-info">
        <div class="summary-item">
          <span class="value">${clients.length}</span>
          <span class="label">Tổng số</span>
        </div>
    `;
    
    // Thêm số liệu theo SSID
    Object.keys(ssidGroups).forEach(ssid => {
      summaryHTML += `
        <div class="summary-item">
          <span class="value">${ssidGroups[ssid]}</span>
          <span class="label">${ssid}</span>
        </div>
      `;
    });
    
    summaryHTML += '</div>';
    container.innerHTML = summaryHTML;
  }
  
  function setupRefreshIntervals() {
    clearAllRefreshIntervals();
    
    // Cài đặt intervals mới
    refreshIntervals.status = setInterval(() => refreshData('status'), 30000);
    refreshIntervals.interfaces = setInterval(() => refreshData('interfaces'), 60000);
    refreshIntervals.accessPoints = setInterval(() => refreshData('access-points'), 30000);
    refreshIntervals.clients = setInterval(() => refreshData('clients'), 15000);
    refreshIntervals.apsSummary = setInterval(() => refreshData('aps-summary'), 30000);
    refreshIntervals.clientsSummary = setInterval(() => refreshData('clients-summary'), 15000);
  }
  
  function clearAllRefreshIntervals() {
    Object.values(refreshIntervals).forEach(interval => clearInterval(interval));
    refreshIntervals = {};
  }
});