const FROM_EMAIL = 'contact@cartertrobinson.me';
const FROM_NAME = 'Food Fight';

const mailjetConfigured = Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET);
const mailjet = mailjetConfigured
  ? require('node-mailjet').apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET,
  )
  : null;

const message = (to, subject, text, html) => {
  const payload = {
    From: {
      Email: FROM_EMAIL,
      Name: FROM_NAME,
    },
    To: [{ Email: to }],
    Subject: subject,
    TextPart: text,
  };
  if (html) {
    payload.HTMLPart = html;
  }
  return payload;
};

const send = ({ to, subject, text, html }) => {
  if (!mailjet) {
    return Promise.resolve(false);
  }
  return mailjet.post('send', { version: 'v3.1' })
    .request({ Messages: [message(to, subject, text, html)] })
    .then(() => true);
};

module.exports = {
  FROM_EMAIL,
  isConfigured: () => Boolean(mailjet),
  message,
  send,
};
