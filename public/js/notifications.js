/**
 * Quản lý thông báo cho hệ thống giám sát MikroTik
 */

let currentNotificationConfig = null;

// Tải cấu hình thông báo khi trang được tải
document.addEventListener('DOMContentLoaded', () => {
  // Tải cấu hình ban đầu
  loadNotificationConfig();
  
  // Gắn sự kiện cho các nút
  setupEventListeners();
});

/**
 * Tải cấu hình thông báo từ API
 */
async function loadNotificationConfig() {
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/config');
    
    if (!response.ok) {
      throw new Error('Failed to load notification configuration');
    }
    
    const config = await response.json();
    currentNotificationConfig = config;
    
    // Hiển thị cấu hình
    displayNotificationConfig(config);
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error loading notification config:', error);
    showAlert('danger', 'Không thể tải cấu hình thông báo: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Thiết lập các sự kiện cho các nút và form
 */
function setupEventListeners() {
  // Form thêm email
  const emailForm = document.getElementById('add-email-form');
  if (emailForm) {
    emailForm.addEventListener('submit', handleAddEmailSubmit);
  }
  
  // Form thêm số điện thoại
  const phoneForm = document.getElementById('add-phone-form');
  if (phoneForm) {
    phoneForm.addEventListener('submit', handleAddPhoneSubmit);
  }
  
  // Bật/tắt thông báo
  const toggleNotificationBtn = document.getElementById('toggle-notification');
  if (toggleNotificationBtn) {
    toggleNotificationBtn.addEventListener('click', handleToggleNotification);
  }
  
  // Bật/tắt email
  const toggleEmailBtn = document.getElementById('toggle-email');
  if (toggleEmailBtn) {
    toggleEmailBtn.addEventListener('click', handleToggleEmail);
  }
  
  // Bật/tắt SMS
  const toggleSmsBtn = document.getElementById('toggle-sms');
  if (toggleSmsBtn) {
    toggleSmsBtn.addEventListener('click', handleToggleSms);
  }
  
  // Nút gửi email thử nghiệm
  const testEmailBtn = document.getElementById('test-email-btn');
  if (testEmailBtn) {
    testEmailBtn.addEventListener('click', handleTestEmail);
  }
  
  // Nút gửi SMS thử nghiệm
  const testSmsBtn = document.getElementById('test-sms-btn');
  if (testSmsBtn) {
    testSmsBtn.addEventListener('click', handleTestSms);
  }
}

/**
 * Hiển thị cấu hình thông báo
 */
function displayNotificationConfig(config) {
  // Cập nhật trạng thái thông báo
  updateToggleButton('toggle-notification', config.enabled);
  updateToggleButton('toggle-email', config.channels.email.enabled);
  updateToggleButton('toggle-sms', config.channels.sms.enabled);
  
  // Hiển thị danh sách email
  const emailList = document.getElementById('email-list');
  if (emailList) {
    emailList.innerHTML = '';
    
    if (config.channels.email.recipients.length === 0) {
      emailList.innerHTML = '<div class="alert alert-info">Chưa có địa chỉ email nào được cấu hình.</div>';
    } else {
      const list = document.createElement('ul');
      list.className = 'list-group';
      
      config.channels.email.recipients.forEach(email => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
          <span>${email}</span>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary test-email" data-email="${email}">
              <i class="bi bi-envelope"></i> Gửi thử
            </button>
            <button class="btn btn-sm btn-danger delete-email" data-email="${email}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        list.appendChild(item);
      });
      
      emailList.appendChild(list);
      
      // Gắn sự kiện cho các nút xóa
      document.querySelectorAll('.delete-email').forEach(btn => {
        btn.addEventListener('click', handleDeleteEmail);
      });
      
      // Gắn sự kiện cho các nút gửi thử
      document.querySelectorAll('.test-email').forEach(btn => {
        btn.addEventListener('click', function() {
          const email = this.getAttribute('data-email');
          sendTestEmail(email);
        });
      });
    }
  }
  
  // Hiển thị danh sách số điện thoại
  const phoneList = document.getElementById('phone-list');
  if (phoneList) {
    phoneList.innerHTML = '';
    
    if (config.channels.sms.recipients.length === 0) {
      phoneList.innerHTML = '<div class="alert alert-info">Chưa có số điện thoại nào được cấu hình.</div>';
    } else {
      const list = document.createElement('ul');
      list.className = 'list-group';
      
      config.channels.sms.recipients.forEach(phone => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
          <span>${phone}</span>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary test-sms" data-phone="${phone}">
              <i class="bi bi-chat-dots"></i> Gửi thử
            </button>
            <button class="btn btn-sm btn-danger delete-phone" data-phone="${phone}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `;
        list.appendChild(item);
      });
      
      phoneList.appendChild(list);
      
      // Gắn sự kiện cho các nút xóa
      document.querySelectorAll('.delete-phone').forEach(btn => {
        btn.addEventListener('click', handleDeletePhone);
      });
      
      // Gắn sự kiện cho các nút gửi thử
      document.querySelectorAll('.test-sms').forEach(btn => {
        btn.addEventListener('click', function() {
          const phone = this.getAttribute('data-phone');
          sendTestSms(phone);
        });
      });
    }
  }
}

/**
 * Cập nhật trạng thái nút bật/tắt
 */
function updateToggleButton(buttonId, enabled) {
  const button = document.getElementById(buttonId);
  if (button) {
    if (enabled) {
      button.innerHTML = '<i class="bi bi-toggle-on"></i> Đang bật';
      button.classList.remove('btn-secondary');
      button.classList.add('btn-success');
      button.setAttribute('data-enabled', 'true');
    } else {
      button.innerHTML = '<i class="bi bi-toggle-off"></i> Đang tắt';
      button.classList.remove('btn-success');
      button.classList.add('btn-secondary');
      button.setAttribute('data-enabled', 'false');
    }
  }
}

/**
 * Xử lý sự kiện khi form thêm email được submit
 */
async function handleAddEmailSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('new-email');
  if (!emailInput) return;
  
  const email = emailInput.value.trim();
  
  if (!email) {
    showAlert('danger', 'Vui lòng nhập địa chỉ email');
    return;
  }
  
  if (!validateEmail(email)) {
    showAlert('danger', 'Địa chỉ email không hợp lệ');
    return;
  }
  
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/recipients/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', 'Đã thêm địa chỉ email thành công');
      emailInput.value = '';
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể thêm địa chỉ email');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error adding email:', error);
    showAlert('danger', 'Lỗi khi thêm email: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện khi form thêm số điện thoại được submit
 */
async function handleAddPhoneSubmit(event) {
  event.preventDefault();
  
  const phoneInput = document.getElementById('new-phone');
  if (!phoneInput) return;
  
  const phone = phoneInput.value.trim();
  
  if (!phone) {
    showAlert('danger', 'Vui lòng nhập số điện thoại');
    return;
  }
  
  if (!validatePhone(phone)) {
    showAlert('danger', 'Số điện thoại không hợp lệ');
    return;
  }
  
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/recipients/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', 'Đã thêm số điện thoại thành công');
      phoneInput.value = '';
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể thêm số điện thoại');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error adding phone:', error);
    showAlert('danger', 'Lỗi khi thêm số điện thoại: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện xóa email
 */
async function handleDeleteEmail(event) {
  const email = this.getAttribute('data-email');
  
  if (!confirm(`Bạn có chắc chắn muốn xóa địa chỉ email "${email}" khỏi danh sách nhận thông báo?`)) {
    return;
  }
  
  try {
    showLoading('notification-config');
    
    const response = await fetch(`/api/notifications/recipients/email/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', 'Đã xóa địa chỉ email thành công');
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể xóa địa chỉ email');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error deleting email:', error);
    showAlert('danger', 'Lỗi khi xóa email: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện xóa số điện thoại
 */
async function handleDeletePhone(event) {
  const phone = this.getAttribute('data-phone');
  
  if (!confirm(`Bạn có chắc chắn muốn xóa số điện thoại "${phone}" khỏi danh sách nhận thông báo?`)) {
    return;
  }
  
  try {
    showLoading('notification-config');
    
    const response = await fetch(`/api/notifications/recipients/sms/${encodeURIComponent(phone)}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', 'Đã xóa số điện thoại thành công');
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể xóa số điện thoại');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error deleting phone:', error);
    showAlert('danger', 'Lỗi khi xóa số điện thoại: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện bật/tắt thông báo
 */
async function handleToggleNotification() {
  const enabled = this.getAttribute('data-enabled') !== 'true';
  
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', `Đã ${enabled ? 'bật' : 'tắt'} thông báo thành công`);
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể thay đổi trạng thái thông báo');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error toggling notification:', error);
    showAlert('danger', 'Lỗi khi thay đổi trạng thái thông báo: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện bật/tắt email
 */
async function handleToggleEmail() {
  const enabled = this.getAttribute('data-enabled') !== 'true';
  
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/channels/email/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', `Đã ${enabled ? 'bật' : 'tắt'} thông báo email thành công`);
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể thay đổi trạng thái thông báo email');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error toggling email:', error);
    showAlert('danger', 'Lỗi khi thay đổi trạng thái thông báo email: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện bật/tắt SMS
 */
async function handleToggleSms() {
  const enabled = this.getAttribute('data-enabled') !== 'true';
  
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/channels/sms/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', `Đã ${enabled ? 'bật' : 'tắt'} thông báo SMS thành công`);
      loadNotificationConfig();
    } else {
      showAlert('danger', result.error || 'Không thể thay đổi trạng thái thông báo SMS');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error toggling SMS:', error);
    showAlert('danger', 'Lỗi khi thay đổi trạng thái thông báo SMS: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện gửi email thử nghiệm
 */
async function handleTestEmail() {
  const emailInput = document.getElementById('test-email');
  if (!emailInput) return;
  
  const email = emailInput.value.trim();
  
  if (!email) {
    showAlert('danger', 'Vui lòng nhập địa chỉ email');
    return;
  }
  
  if (!validateEmail(email)) {
    showAlert('danger', 'Địa chỉ email không hợp lệ');
    return;
  }
  
  sendTestEmail(email);
}

/**
 * Gửi email thử nghiệm
 */
async function sendTestEmail(email) {
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/test/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', `Đã gửi email thử nghiệm đến ${email}`);
    } else {
      showAlert('danger', result.error || 'Không thể gửi email thử nghiệm');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error sending test email:', error);
    showAlert('danger', 'Lỗi khi gửi email thử nghiệm: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Xử lý sự kiện gửi SMS thử nghiệm
 */
async function handleTestSms() {
  const phoneInput = document.getElementById('test-phone');
  if (!phoneInput) return;
  
  const phone = phoneInput.value.trim();
  
  if (!phone) {
    showAlert('danger', 'Vui lòng nhập số điện thoại');
    return;
  }
  
  if (!validatePhone(phone)) {
    showAlert('danger', 'Số điện thoại không hợp lệ');
    return;
  }
  
  sendTestSms(phone);
}

/**
 * Gửi SMS thử nghiệm
 */
async function sendTestSms(phone) {
  try {
    showLoading('notification-config');
    
    const response = await fetch('/api/notifications/test/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAlert('success', `Đã gửi SMS thử nghiệm đến ${phone}`);
    } else {
      showAlert('danger', result.error || 'Không thể gửi SMS thử nghiệm');
    }
    
    hideLoading('notification-config');
  } catch (error) {
    console.error('Error sending test SMS:', error);
    showAlert('danger', 'Lỗi khi gửi SMS thử nghiệm: ' + error.message);
    hideLoading('notification-config');
  }
}

/**
 * Kiểm tra địa chỉ email hợp lệ
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Kiểm tra số điện thoại hợp lệ
 */
function validatePhone(phone) {
  // Số điện thoại hợp lệ là số bắt đầu bằng + hoặc số 0
  const re = /^(\+|0)\d{9,15}$/;
  return re.test(phone);
}

/**
 * Hiển thị loading spinner
 */
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    if (!container.querySelector('.loading-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
      container.appendChild(overlay);
    } else {
      container.querySelector('.loading-overlay').style.display = 'flex';
    }
  }
}

/**
 * Ẩn loading spinner
 */
function hideLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    const overlay = container.querySelector('.loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}

/**
 * Hiển thị thông báo
 */
function showAlert(type, message, autoClose = true) {
  const alertsContainer = document.getElementById('alerts-container');
  if (!alertsContainer) return;
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertsContainer.appendChild(alert);
  
  if (autoClose) {
    setTimeout(() => {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  }
}