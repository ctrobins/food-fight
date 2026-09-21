require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const passport = require('passport');
const flash = require('flash');
const auth = require('../lib/auth');
const morgan = require('morgan');
const socket = require('socket.io');

const mailjetConfigured = process.env.MAILJET_API_KEY && process.env.MAILJET_API_SECRET;
const Mailjet = mailjetConfigured
  ? require('node-mailjet').apiConnect(
    process.env.MAILJET_API_KEY,
    process.env.MAILJET_API_SECRET,
  )
  : null;

const db = require('../database-postgresql/models/index');
const dbHelpers = require('../db-controllers');
const { migrate } = require('../database-postgresql/migrate');
const { publicUser } = require('../lib/auth');

const { Op } = db;

const isGoogleOAuthConfigured = () => (
  Boolean(process.env.GOOGLE_AUTH_CLIENT_ID && process.env.GOOGLE_AUTH_CLIENT_SECRET)
);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

const rejectCrossSiteMutation = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get('origin');
  if (!origin) {
    next();
    return;
  }
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch (err) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }
  if (originHost !== req.get('host')) {
    res.status(403).json({ error: 'Cross-site request blocked' });
    return;
  }
  next();
};

app.use(rejectCrossSiteMutation);


//
// ─── AUTHENTICAITON MIDDLEWARE ──────────────────────────────────────────────────
//
if (!process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is required. Set it in .env before starting the server.');
  process.exit(1);
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));
app.use(passport.initialize());
app.use(passport.session());
auth.passportHelper();
app.use((req, res, next) => {
  const stored = req.session && req.session.passport && req.session.passport.user;
  if (stored && typeof stored === 'object') {
    req.session.passport.user = stored.id;
  }
  next();
});
app.use(flash());

const requireUser = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: 'Log in to continue' });
    return;
  }
  next();
};

const sendError = (res, err) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong' : err.message,
    missing: err.missing,
  });
};

const authenticateLocal = (strategy) => (req, res, next) => {
  passport.authenticate(strategy, (err, user, info) => {
    if (err) {
      sendError(res, err);
      return;
    }
    if (!user) {
      res.status(401).json({ error: (info && info.message) || 'Invalid email or password' });
      return;
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        sendError(res, loginErr);
        return;
      }
      res.json({ user: publicUser(req.user) });
    });
  })(req, res, next);
};


//
// ─── GOOGLE OAUTH ENDPOINTS ─────────────────────────────────────────────────────
//
app.get('/api/auth/providers', (req, res) => {
  res.json({
    local: true,
    google: isGoogleOAuthConfigured(),
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!isGoogleOAuthConfigured()) {
    res.redirect('/?googleSignIn=unavailable');
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get(
  '/auth/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured()) {
      res.redirect('/?googleSignIn=unavailable');
      return;
    }
    next();
  },
  passport.authenticate('google', { failureRedirect: '/?googleSignIn=failed' }),
  (req, res) => {
    if (req.user && req.user.zipcode == null) {
      res.redirect('/?setZip=1');
      return;
    }
    res.redirect('/');
  },
);


//
// ─── LOCAL AUTH ENDPOINTS ───────────────────────────────────────────────────────
//
app.get('/checklogin', (req, res) => {
  res.status(200).json({ user: publicUser(req.user) });
});

app.post('/api/profile/zip', requireUser, async (req, res) => {
  const zip = Number(String(req.body.zip || '').trim());
  if (!Number.isInteger(zip) || String(zip).length !== 5) {
    res.status(400).json({ error: 'Enter a 5-digit zip code' });
    return;
  }
  try {
    await db.models.User.update({ zipcode: zip }, { where: { id: req.user.id } });
    res.json({ user: { ...publicUser(req.user), zipcode: zip } });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/subscribe', authenticateLocal('local-signup'));

app.post('/login', authenticateLocal('local-login'));

app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    res.json({ ok: true });
  });
});


//
// ─── USER SEARCH AND INVITE ─────────────────────────────────────────────────────
//
app.post('/searchUsers', (req, res) => {
  const query = (req.body.query || '').trim();
  if (!query) {
    res.status(200).send([]);
    return;
  }
  db.models.User.findAll({
    limit: 10,
    attributes: ['id', 'email'],
    where: {
      email: {
        [Op.iLike]: `%${query}%`,
      },
    },
  })
    .then((matches) => res.status(200).send(matches))
    .catch((err) => res.status(500).send(err.message));
});


//
// ─── SERVE EMAIL INVITATIONS ────────────────────────────────────────────────────
//
app.post('/api/signupEmail', (req, res) => {
  if (!Mailjet) {
    console.log('Mailjet not configured; would invite', req.body.email);
    res.end('Email skipped (Mailjet not configured)');
    return;
  }
  console.log('Received request to send email to', req.body.email);
  const { email } = req.body;
  const emailData = {
    FromEmail: 'foodfightHR@gmail.com',
    FromName: 'Food Fight',
    Subject: 'You\'ve been invited to Food Fight!',
    'Text-part': `You've been invited to a Food Fight. Visit ${process.env.DOMAIN || 'http://localhost:3000/'}signup to signup.`,
    Recipients: [{ Email: email }],
  };
  Mailjet.post('send', { version: 'v3.1' })
    .request({ Messages: [{ ...emailData }] })
    .then(() => {
      res.end('Email sent!');
    })
    .catch((err) => {
      console.log('Error in interacting with the MailJet API', err);
      res.status(404).end();
    });
});

app.post('/api/roomEmail', (req, res) => {
  if (!Mailjet) {
    console.log('Mailjet not configured; would send room invite', req.body);
    res.end('Email skipped (Mailjet not configured)');
    return;
  }
  console.log('Received request to send email to', req.body);
  const { email, roomInfo } = req.body;
  const emailData = {
    FromEmail: 'foodfightHR@gmail.com',
    FromName: 'Food Fight',
    Subject: 'You\'ve been invited to join a Food Fight room!',
    'Text-part': `You've been invited to a Food Fight room. Visit ${process.env.DOMAIN || 'http://localhost:3000/'}rooms/${roomInfo.uniqueid} to join.`,
    Recipients: [{ Email: email }],
  };
  Mailjet.post('send', { version: 'v3.1' })
    .request({ Messages: [{ ...emailData }] })
    .then(() => {
      res.end('Email sent!');
    })
    .catch((err) => {
      console.log('Error in interacting with the MailJet API', err);
      res.status(404).end();
    });
});


//
// ─── CREATE ROOMS AND GET ROOM INFO ─────────────────────────────────────────────
//
app.post('/api/save', requireUser, async (req, res) => {
  const { roomName, zip, members } = req.body;
  try {
    const room = await dbHelpers.saveRoomAndMembers(roomName, zip, members, req.user.id);
    res.json(room);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/rooms/:roomID', async (req, res) => {
  const { roomID } = req.params;
  try {
    const roomMembers = await dbHelpers.getRoomMembers(roomID);
    res.json(roomMembers);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/room-redirect', (req, res) => {
  console.log(req.body);
  res.redirect(307, `/rooms/${req.body.id}`);
});


//
// ─── EXTERNAL API LOGIC ─────────────────────────────────────────────────────────
//
app.post('/api/search', async (req, res) => {
  console.log('Received request for Yelp search of', req.body);
  const { zip } = req.body;
  if (!process.env.YELP_API_KEY) {
    res.status(503).json({ error: 'Yelp API key not configured', businesses: [] });
    return;
  }
  try {
    const { data } = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: {
        Authorization: `Bearer ${process.env.YELP_API_KEY}`,
      },
      params: {
        location: zip,
      },
    });
    res.send(data);
  } catch (err) {
    console.log('Error in interacting with the Yelp API', err.message);
    res.status(404).end();
  }
});


//
// ─── HANDLE MESSAGES AND VOTES─────────────────────────────────────────────────────────
//
app.post('/api/messages', async (req, res) => {
  const { message, roomID } = req.body;
  if (!message || typeof message.message !== 'string' || !roomID) {
    res.status(400).json({ error: 'Message and room are required' });
    return;
  }
  try {
    const savedMessage = await dbHelpers.saveMessage(message.name, message.message, roomID);
    res.status(200).json(savedMessage);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/messages/:roomID', async (req, res) => {
  const { roomID } = req.params;
  try {
    const fetchedMessages = await dbHelpers.getMessages(roomID);
    res.json(fetchedMessages);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/nominate', async (req, res) => {
  const { name, roomID } = req.body;
  try {
    const restaurant = await dbHelpers.saveRestaurant(name, roomID);
    res.status(200).json(restaurant);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/votes', requireUser, async (req, res) => {
  const { restaurantId, roomID } = req.body;
  try {
    const restaurant = await dbHelpers.updateVotes(restaurantId, roomID, req.user.id);
    res.status(200).json(restaurant);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/vetoes', requireUser, async (req, res) => {
  const { restaurantId, roomID } = req.body;
  try {
    const restaurant = await dbHelpers.updateVetoes(restaurantId, roomID);
    res.status(200).json(restaurant);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/votes/:roomID', async (req, res) => {
  const { roomID } = req.params;
  try {
    const scores = await dbHelpers.getScoreboard(roomID, req.user && req.user.id);
    res.json(scores);
  } catch (err) {
    sendError(res, err);
  }
});

// ────────────────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, '../react-client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../react-client/dist/index.html'));
});

migrate(db.models.sequelize).then(() => {
  const server = app.listen(process.env.PORT || 3000, () => {
    console.log('listening on port', process.env.PORT || 3000);
  });

  const io = socket(server);

  const isValidRoomId = (roomID) => typeof roomID === 'string' && roomID.length > 0;

  const socketIsInRoom = (socket, roomID) => socket.rooms.has(roomID);

  io.on('connection', (newSocket) => {
    console.log('made socket connection', newSocket.id);

    newSocket.on('join', (roomID) => {
      if (!isValidRoomId(roomID)) {
        console.log('Ignored join: invalid roomID', roomID);
        return;
      }
      newSocket.join(roomID, (err) => {
        if (err) {
          console.log('Error joining room', roomID, err);
          return;
        }
        console.log('Socket', newSocket.id, 'joined room', roomID);
        newSocket.to(roomID).emit('join', roomID);
      });
    });

    newSocket.on('chat', (data) => {
      const { roomID } = data || {};
      if (!isValidRoomId(roomID) || !socketIsInRoom(newSocket, roomID)) {
        console.log('Ignored chat: socket not in room', roomID);
        return;
      }
      console.log('Received chat!', data);
      io.to(roomID).emit('chat', data);
    });

    newSocket.on('nominate', (data) => {
      const { roomID } = data || {};
      if (!isValidRoomId(roomID) || !socketIsInRoom(newSocket, roomID)) {
        console.log('Ignored nominate: socket not in room', roomID);
        return;
      }
      console.log('Nomination received!', data);
      io.to(roomID).emit('nominate', data);
    });

    newSocket.on('vote', (data) => {
      const { roomID } = data || {};
      if (!isValidRoomId(roomID) || !socketIsInRoom(newSocket, roomID)) {
        console.log('Ignored vote: socket not in room', roomID);
        return;
      }
      console.log('Received vote!', data);
      io.to(roomID).emit('vote', roomID);
    });

    newSocket.on('veto', (data) => {
      const { roomID } = data || {};
      if (!isValidRoomId(roomID) || !socketIsInRoom(newSocket, roomID)) {
        console.log('Ignored veto: socket not in room', roomID);
        return;
      }
      console.log('Received veto!', data);
      io.to(roomID).emit('veto', roomID);
    });
  });
}).catch((err) => {
  console.error('Failed to migrate database:', err.message);
  process.exit(1);
});
