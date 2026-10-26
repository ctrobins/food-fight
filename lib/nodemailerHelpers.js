const nodemailer = require('nodemailer');
const mail = require('./mail');

const hasGmail = process.env.GMAIL_ADDRESS && process.env.GMAIL_PASSWORD;

const transporter = hasGmail
  ? nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_PASSWORD,
    },
  })
  : null;

exports.signupOptions = (address) => ({
  from: mail.isConfigured() ? mail.FROM_EMAIL : (process.env.GMAIL_ADDRESS || 'foodfight@localhost'),
  to: address,
  subject: 'You\'ve been invited to a Food Fight!',
  text: 'Visit http://foodfight.cartertrobinson.me/ to get started.',
});

exports.sendMail = (options) => {
  if (mail.isConfigured()) {
    mail.send(options).catch((error) => {
      console.log(error);
    });
    return;
  }
  if (!transporter) {
    console.log('Mail not configured; skipping welcome email to', options.to);
    return;
  }
  transporter.sendMail(options, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Message sent: %s', info.messageId);
  });
};
