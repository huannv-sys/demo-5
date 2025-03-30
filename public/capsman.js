document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const statusIndicator = document.getElementById('status-indicator');
  const connectionForm = document.getElementById('connection-form');
  const mainContent = document.getElementById('main-content');
  
  // Navigation
  const navLinks = document.querySelectorAll('.sidebar nav a');
  const sections = document.querySelectorAll('.section');
  
  // State
  let isConnected = false;
  let refreshIntervals = {};
  
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
  
  // Check connection status on page load
  checkConnectionStatus();
  
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    
    const container = document.getElementById('toast-container');
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          container.removeChild(toast);
        }, 300);
      }, 3000);
    }, 100);
  }
  
  function checkConnectionStatus() {
    // Thay đổi: kiểm tra kết nối server thay vì hiển thị form
    fetch('/api/router/status')
      .then(response => response.json())
      .then(data => {
        if (data.success && data.connected) {
          updateConnectionStatus(true);
          loadAllData();
        } else {
          updateConnectionStatus(false);
          showToast('Chưa kết nối đến router. Vui lòng kết nối từ trang WebFig chính.', 'error');
          connectionForm.style.display = 'block';
        }
      })
      .catch(error => {
        console.error('Error checking connection status:', error);
        updateConnectionStatus(false);
        showToast('Không thể kiểm tra trạng thái kết nối. Vui lòng thử lại sau.', 'error');
      });
  }
  
  function updateConnectionStatus(connected) {
    isConnected = connected;
    
    if (connected) {
      statusIndicator.textContent = 'Đang kết nối';
      statusIndicator.className = 'connected';
      connectionForm.style.display = 'none';
      mainContent.style.display = 'flex';
      setupRefreshIntervals();
    } else {
      statusIndicator.textContent = 'Chưa kết nối';
      statusIndicator.className = '';
      mainContent.style.display = 'none';
      clearAllRefreshIntervals();
    }
  }
  
  function loadAllData() {
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
    switch (target) {
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
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Đang tải...</div>';
    
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          renderFunction(data.data, container);
        } else {
          container.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i> ${data.message || 'Không thể tải dữ liệu'}</div>`;
        }
      })
      .catch(error => {
        console.error(`Error fetching data from ${url}:`, error);
        container.innerHTML = '<div class="error"><i class="fas fa-exclamation-circle"></i> Lỗi kết nối server</div>';
      });
  }
  
  function renderInterfacesTable(interfaces, container) {
    if (!interfaces || interfaces.length === 0) {
      container.innerHTML = '<div class="no-data">Không có interface CAPsMAN nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>MAC</th>
            <th>Cấu hình</th>
            <th>Trạng thái</th>
            <th>Radio</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    interfaces.forEach(iface => {
      html += `
        <tr>
          <td>${iface.name || '-'}</td>
          <td>${iface['mac-address'] || '-'}</td>
          <td>${iface.configuration || '-'}</td>
          <td>${iface.inactive === 'false' ? '<span class="status active">Active</span>' : '<span class="status inactive">Inactive</span>'}</td>
          <td>${iface.radio || '-'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderAccessPointsTable(accessPoints, container) {
    if (!accessPoints || accessPoints.length === 0) {
      container.innerHTML = '<div class="no-data">Không có Access Point nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Interface</th>
            <th>MAC</th>
            <th>Radio</th>
            <th>Channel</th>
            <th>Signal</th>
            <th>Uptime</th>
            <th>Clients</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    accessPoints.forEach(ap => {
      html += `
        <tr>
          <td>${ap.interface || '-'}</td>
          <td>${ap['mac-address'] || '-'}</td>
          <td>${ap.radio || '-'}</td>
          <td>${ap.channel || '-'}</td>
          <td>${ap['signal-strength'] ? ap['signal-strength'] + ' dBm' : '-'}</td>
          <td>${ap.uptime || '-'}</td>
          <td>${ap['current-clients'] || '0'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderClientsTable(clients, container) {
    if (!clients || clients.length === 0) {
      container.innerHTML = '<div class="no-data">Không có Client nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>MAC</th>
            <th>Interface</th>
            <th>Signal</th>
            <th>TX/RX Rate</th>
            <th>Uptime</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    clients.forEach(client => {
      html += `
        <tr>
          <td>${client.mac_address || '-'}</td>
          <td>${client.interface || '-'}</td>
          <td>${client.rx_signal || '-'}</td>
          <td>${client.tx_rate || '-'} / ${client.rx_rate || '-'}</td>
          <td>${client.uptime || '-'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderConfigurationsTable(configurations, container) {
    if (!configurations || configurations.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>SSID</th>
            <th>Security</th>
            <th>Channel</th>
            <th>Mode</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    configurations.forEach(config => {
      html += `
        <tr>
          <td>${config.name || '-'}</td>
          <td>${config.ssid || '-'}</td>
          <td>${config.security || '-'}</td>
          <td>${config.channel || '-'}</td>
          <td>${config.mode || '-'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderChannelsTable(channels, container) {
    if (!channels || channels.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình kênh nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Band</th>
            <th>Frequency</th>
            <th>Width</th>
            <th>TX Power</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    channels.forEach(channel => {
      html += `
        <tr>
          <td>${channel.name || '-'}</td>
          <td>${channel.band || '-'}</td>
          <td>${channel.frequency || '-'} MHz</td>
          <td>${channel.width || '-'}</td>
          <td>${channel['tx-power'] || '-'} dBm</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderSecurityTable(securityConfigs, container) {
    if (!securityConfigs || securityConfigs.length === 0) {
      container.innerHTML = '<div class="no-data">Không có cấu hình bảo mật nào</div>';
      return;
    }
    
    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Authentication</th>
            <th>Encryption</th>
            <th>Group Key Update</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    securityConfigs.forEach(config => {
      html += `
        <tr>
          <td>${config.name || '-'}</td>
          <td>${config.authentication || '-'}</td>
          <td>${config.encryption || '-'}</td>
          <td>${config['group-key-update'] || '-'}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  function renderAPsSummary(accessPoints, container) {
    const activeAPs = accessPoints.filter(ap => ap.inactive === 'false').length;
    const totalAPs = accessPoints.length;
    
    const html = `
      <div class="summary-data">
        <div class="summary-item">
          <span class="summary-value">${totalAPs}</span>
          <span class="summary-label">Total APs</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${activeAPs}</span>
          <span class="summary-label">Active</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">${totalAPs - activeAPs}</span>
          <span class="summary-label">Inactive</span>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }
  
  function renderClientsSummary(clients, container) {
    const totalClients = clients.length;
    
    const html = `
      <div class="summary-data">
        <div class="summary-item large">
          <span class="summary-value">${totalClients}</span>
          <span class="summary-label">Connected Clients</span>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }
  
  function setupRefreshIntervals() {
    // Clear existing intervals first
    clearAllRefreshIntervals();
    
    // Set new intervals (refresh every 30 seconds)
    refreshIntervals.interfaces = setInterval(() => refreshData('interfaces'), 30000);
    refreshIntervals.accessPoints = setInterval(() => refreshData('access-points'), 30000);
    refreshIntervals.clients = setInterval(() => refreshData('clients'), 15000); // Refresh clients more frequently
    refreshIntervals.apsSummary = setInterval(() => refreshData('aps-summary'), 30000);
    refreshIntervals.clientsSummary = setInterval(() => refreshData('clients-summary'), 15000);
  }
  
  function clearAllRefreshIntervals() {
    Object.values(refreshIntervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    refreshIntervals = {};
  }
});