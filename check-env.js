import 'dotenv/config';

// Kiểm tra cấu hình API MikroTik
console.log('USE_REAL_MIKROTIK_API:', process.env.USE_REAL_MIKROTIK_API);
console.log('typeof:', typeof process.env.USE_REAL_MIKROTIK_API);

// Kiểm tra cấu hình Twilio
console.log('\n--- Thông tin cấu hình Twilio ---');
if (process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_PHONE_NUMBER) {
  console.log('Twilio được cấu hình đầy đủ.');
  console.log('TWILIO_ACCOUNT_SID:', maskSecret(process.env.TWILIO_ACCOUNT_SID));
  console.log('TWILIO_AUTH_TOKEN:', maskSecret(process.env.TWILIO_AUTH_TOKEN));
  console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER);
} else {
  console.log('CẢNH BÁO: Cấu hình Twilio không đầy đủ!');
  console.log('Thiếu biến môi trường:');
  if (!process.env.TWILIO_ACCOUNT_SID) console.log('- TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) console.log('- TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_PHONE_NUMBER) console.log('- TWILIO_PHONE_NUMBER');
}

// Kiểm tra cấu hình SendGrid
console.log('\n--- Thông tin cấu hình SendGrid ---');
if (process.env.SENDGRID_API_KEY) {
  console.log('SendGrid được cấu hình đầy đủ.');
  console.log('SENDGRID_API_KEY:', maskSecret(process.env.SENDGRID_API_KEY));
} else {
  console.log('CẢNH BÁO: Cấu hình SendGrid không đầy đủ!');
  console.log('Thiếu biến môi trường: SENDGRID_API_KEY');
}

// Hàm che giấu thông tin bí mật
function maskSecret(secret) {
  if (!secret) return 'chưa cấu hình';
  const firstChars = secret.substring(0, 4);
  const lastChars = secret.substring(secret.length - 4);
  const maskedPart = '*'.repeat(Math.max(0, secret.length - 8));
  return `${firstChars}${maskedPart}${lastChars}`;
}
