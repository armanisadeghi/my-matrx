
const nodemailer = require('nodemailer');

// Configure with your Supabase SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Fixed: should be smtp.gmail.com for Gmail
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: 'info@aimatrx.com',
    pass: 'fcdl lcem mgqy dcuk' // ⚠️  ISSUE: Gmail requires App Password, not regular password!
    // To fix: Generate Gmail App Password at https://myaccount.google.com/apppasswords
  },
  debug: true, // Enable debug logging
  logger: true // Enable logger
});

// Test the connection
transporter.verify(function(error, success) {
  if (error) {
    console.log('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
    
    // Send a test email
    sendTestEmail();
  }
});

function sendTestEmail() {
  const mailOptions = {
    from: '"AI Matrx" <info@aimatrx.com>',
    to: 'info@aimatrx.com', // Send to yourself for testing
    subject: 'SMTP Test Email from Supabase',
    text: 'This is a test email to verify SMTP configuration is working correctly.',
    html: '<p>This is a <strong>test email</strong> to verify SMTP configuration is working correctly.</p>'
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email:', error);
    } else {
      console.log('Email sent successfully!');
      console.log('Message ID:', info.messageId);
      console.log('Response:', info.response);
    }
  });
}