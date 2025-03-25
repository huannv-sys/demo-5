/**
 * API routes cho hệ thống thông báo
 * Cung cấp các endpoints để quản lý cấu hình thông báo và gửi thông báo thử nghiệm
 */

import express from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Đường dẫn đến thư mục cấu hình
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const NOTIFICATION_CONFIG_PATH = path.join(CONFIG_DIR, 'notification_config.json');

// Đảm bảo thư mục cấu hình tồn tại
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Tạo cấu hình mặc định nếu chưa tồn tại
if (!fs.existsSync(NOTIFICATION_CONFIG_PATH)) {
  const defaultConfig = {
    enabled: true,
    channels: {
      email: {
        enabled: true,
        recipients: []
      },
      sms: {
        enabled: true,
        recipients: []
      }
    },
    alerts: {
      connection_lost: {
        enabled: true,
        channels: ["email", "sms"],
        message: "Mất kết nối đến thiết bị {device_name}",
        cooldown: 300
      },
      high_cpu: {
        enabled: true,
        channels: ["email"],
        message: "CPU của thiết bị {device_name} đang cao: {cpu_load}%",
        threshold: 80,
        cooldown: 300
      },
      high_memory: {
        enabled: true,
        channels: ["email"],
        message: "Bộ nhớ của thiết bị {device_name} đang cao: {memory_percent}%",
        threshold: 80,
        cooldown: 300
      },
      interface_down: {
        enabled: true,
        channels: ["email", "sms"],
        message: "Interface {interface_name} trên thiết bị {device_name} ngừng hoạt động",
        cooldown: 300
      }
    }
  };
  
  fs.writeFileSync(NOTIFICATION_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
}

/**
 * Đọc cấu hình thông báo
 */
function getNotificationConfig() {
  try {
    const configData = fs.readFileSync(NOTIFICATION_CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading notification config:', error);
    return null;
  }
}

/**
 * Lưu cấu hình thông báo
 */
function saveNotificationConfig(config) {
  try {
    fs.writeFileSync(NOTIFICATION_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving notification config:', error);
    return false;
  }
}

/**
 * Lấy cấu hình thông báo
 */
router.get('/config', (req, res) => {
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  res.json(config);
});

/**
 * Bật/tắt thông báo
 */
router.post('/toggle', (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request. "enabled" must be a boolean.' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  config.enabled = enabled;
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, enabled });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Bật/tắt kênh thông báo (email/sms)
 */
router.post('/channels/:channel/toggle', (req, res) => {
  const { channel } = req.params;
  const { enabled } = req.body;
  
  if (channel !== 'email' && channel !== 'sms') {
    return res.status(400).json({ error: 'Invalid channel. Must be "email" or "sms".' });
  }
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request. "enabled" must be a boolean.' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  config.channels[channel].enabled = enabled;
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, channel, enabled });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Thêm email vào danh sách nhận thông báo
 */
router.post('/recipients/email', (req, res) => {
  const { email } = req.body;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  
  // Kiểm tra định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  // Kiểm tra xem email đã tồn tại chưa
  if (config.channels.email.recipients.includes(email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  
  // Thêm email vào danh sách
  config.channels.email.recipients.push(email);
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, email });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Xóa email khỏi danh sách nhận thông báo
 */
router.delete('/recipients/email/:email', (req, res) => {
  const { email } = req.params;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  // Kiểm tra xem email có tồn tại không
  const index = config.channels.email.recipients.indexOf(email);
  if (index === -1) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  // Xóa email khỏi danh sách
  config.channels.email.recipients.splice(index, 1);
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, email });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Thêm số điện thoại vào danh sách nhận thông báo
 */
router.post('/recipients/sms', (req, res) => {
  const { phone } = req.body;
  
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  
  // Kiểm tra định dạng số điện thoại
  const phoneRegex = /^(\+|0)\d{9,15}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  // Kiểm tra xem số điện thoại đã tồn tại chưa
  if (config.channels.sms.recipients.includes(phone)) {
    return res.status(409).json({ error: 'Phone number already exists' });
  }
  
  // Thêm số điện thoại vào danh sách
  config.channels.sms.recipients.push(phone);
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, phone });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Xóa số điện thoại khỏi danh sách nhận thông báo
 */
router.delete('/recipients/sms/:phone', (req, res) => {
  const { phone } = req.params;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  const config = getNotificationConfig();
  
  if (!config) {
    return res.status(500).json({ error: 'Failed to read notification configuration' });
  }
  
  // Kiểm tra xem số điện thoại có tồn tại không
  const index = config.channels.sms.recipients.indexOf(phone);
  if (index === -1) {
    return res.status(404).json({ error: 'Phone number not found' });
  }
  
  // Xóa số điện thoại khỏi danh sách
  config.channels.sms.recipients.splice(index, 1);
  
  if (saveNotificationConfig(config)) {
    res.json({ success: true, phone });
  } else {
    res.status(500).json({ error: 'Failed to save notification configuration' });
  }
});

/**
 * Gửi email thử nghiệm
 */
router.post('/test/email', (req, res) => {
  const { email } = req.body;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  
  // Kiểm tra định dạng email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Thực thi script Python để gửi email thử nghiệm
  const scriptPath = path.join(__dirname, '..', 'scripts', 'test_notification.py');
  const command = `python ${scriptPath} --email "${email}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing test_notification.py: ${error}`);
      return res.status(500).json({ error: `Failed to send test email: ${stderr || error.message}` });
    }
    
    console.log(`Test email sent to ${email}: ${stdout}`);
    res.json({ success: true, message: `Test email sent to ${email}` });
  });
});

/**
 * Gửi SMS thử nghiệm
 */
router.post('/test/sms', (req, res) => {
  const { phone } = req.body;
  
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  
  // Kiểm tra định dạng số điện thoại
  const phoneRegex = /^(\+|0)\d{9,15}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }
  
  // Thực thi script Python để gửi SMS thử nghiệm
  const scriptPath = path.join(__dirname, '..', 'scripts', 'test_notification.py');
  const command = `python ${scriptPath} --sms "${phone}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing test_notification.py: ${error}`);
      return res.status(500).json({ error: `Failed to send test SMS: ${stderr || error.message}` });
    }
    
    console.log(`Test SMS sent to ${phone}: ${stdout}`);
    res.json({ success: true, message: `Test SMS sent to ${phone}` });
  });
});

export default router;