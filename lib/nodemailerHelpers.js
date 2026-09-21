const nodemailer = require('nodemailer');

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
  from: process.env.GMAIL_ADDRESS || 'foodfight@localhost',
  to: address,
  subject: 'Welcome to the FoodFight!',
  html: `<b>Go to <a href='${process.env.DOMAIN || 'http://localhost:3000/'}'>${process.env.DOMAIN || 'http://localhost:3000/'}</a> to get started!</b>`,
});

exports.sendMail = (options) => {
  if (!transporter) {
    console.log('Gmail not configured; skipping welcome email to', options.to);
    return;
  }
  transporter.sendMail(options, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Message sent: %s', info.messageId);
  });
};
