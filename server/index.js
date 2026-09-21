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

const { Op } = db;

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../react-client/dist')));
app.use(morgan('dev'));


//
// ─── AUTHENTICAITON MIDDLEWARE ──────────────────────────────────────────────────
//
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
  },
}));
app.use(passport.initialize());
app.use(passport.session());
auth.passportHelper();
app.use(flash());


//
// ─── GOOGLE OAUTH ENDPOINTS ─────────────────────────────────────────────────────
//
if (process.env.GOOGLE_AUTH_CLIENT_ID && process.env.GOOGLE_AUTH_CLIENT_SECRET) {
  app.get(
    '/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
    }),
  );

  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/');
    },
  );
}


//
// ─── LOCAL AUTH ENDPOINTS ───────────────────────────────────────────────────────
//
app.get('/checklogin', (req, res) => {
  res.status(200).send(req.session.passport);
});

app.post('/subscribe', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureFlash: true,
}), (req, res) => {
  res.status(200).redirect('/');
});

app.post('/login', passport.authenticate('local-login', {
  successRedirect: '/',
  failureFlash: true,
}));

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    return res.redirect('/');
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
app.post('/api/save', (req, res) => {
  const { roomName, zip, members } = req.body;
  dbHelpers.saveRoomAndMembers(roomName, zip, members, (err, room) => {
    if (err) {
      console.log('Error saving room and members', err);
      res.status(500).end();
    } else {
      res.send(room[0].dataValues);
    }
  });
});

app.get('/api/rooms/:roomID', (req, res) => {
  const { roomID } = req.params;
  dbHelpers.getRoomMembers(roomID, (err, roomMembers) => {
    if (err) {
      console.log('Error getting room members', err);
      res.status(500).end();
    } else {
      res.send(roomMembers);
    }
  });
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
app.post('/api/messages', (req, res) => {
  const { message, roomID } = req.body;
  dbHelpers.saveMessage(message.name, message.message, roomID, (err, savedMessage) => {
    if (err) {
      console.log('Error saving message', err);
      res.status(404).end();
    } else {
      res.end('Message saved', savedMessage);
    }
  });
});

app.get('/api/messages/:roomID', (req, res) => {
  const { roomID } = req.params;
  dbHelpers.getMessages(roomID, (err, fetchedMessages) => {
    if (err) {
      console.log('Error retrieving messages', err);
      res.status(404).end();
    } else {
      console.log('Messages retrieved!', fetchedMessages);
      res.send(fetchedMessages);
    }
  });
});

app.post('/api/nominate', (req, res) => {
  const { name, roomID } = req.body;
  dbHelpers.saveRestaurant(name, roomID, (err, restaurant) => {
    if (err) {
      console.log('Error saving restaurant', err);
      res.status(500).end();
    } else {
      res.end('Restaurant saved!', restaurant);
    }
  });
});

app.post('/api/votes', (req, res) => {
  const { name, roomID } = req.body;
  dbHelpers.updateVotes(name, roomID, (err, restaurant) => {
    if (err) {
      console.log('Error upvoting restaurant', err);
      res.status(500).end();
    } else {
      res.end('Restaurant upvoted!', restaurant);
    }
  });
});

app.post('/api/vetoes', (req, res) => {
  const { name, roomID } = req.body;
  dbHelpers.updateVetoes(name, roomID, (err, restaurant) => {
    if (err) {
      console.log('Error vetoing restaurant', err);
      res.status(500).end();
    } else {
      res.end('Restaurant vetoed!', restaurant);
    }
  });
});

app.get('/api/votes/:roomID', (req, res) => {
  const { roomID } = req.params;
  dbHelpers.getScoreboard(roomID, (err, scores) => {
    if (err) {
      console.log('Error fetching scoreboard', err);
      res.status(500).end();
    } else {
      res.send(scores);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────────


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../react-client/dist/index.html'));
});

db.models.sequelize.sync().then(() => {
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
  console.error('Failed to sync database:', err.message);
  process.exit(1);
});
