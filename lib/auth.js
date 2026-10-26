const passport = require('passport');
const db = require('../database-postgresql/models/index');
const dbHelpers = require('../db-controllers/index');
const bcrypt = require('bcrypt');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const email = require('./nodemailerHelpers');


//
// ─── LOCAL STRATEGY ─────────────────────────────────────────────────────────────
//
exports.passportHelper = () => {
  passport.use('local-signup', new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    ((req, username, password, done) => {
      db.models.User.findOne({ where: { email: username } })
        .then((foundUser) => {
          if (foundUser) {
            done(null, false, { message: 'An account with that email already exists' });
            return;
          }
          dbHelpers.saveMember(username, password, req.body.zip)
            .then((userToSave) => {
              const options = email.signupOptions(username);
              email.sendMail(options);
              done(null, userToSave);
            })
            .catch((err) => done(err));
        })
        .catch((err) => done(err));
    }),
  ));

  passport.use('local-login', new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    ((req, username, password, done) => {
      db.models.User.findOne({ where: { email: username } })
        .then((foundUser) => {
          if (!foundUser) {
            done(null, false, { message: 'Invalid email or password' });
            return;
          }
          bcrypt.compare(password, foundUser.password)
            .then((valid) => {
              if (valid) {
                done(null, foundUser);
              } else {
                done(null, false, { message: 'Invalid email or password' });
              }
            })
            .catch((err) => done(err));
        })
        .catch((err) => done(err));
    }),
  ));

  if (process.env.GOOGLE_AUTH_CLIENT_ID && process.env.GOOGLE_AUTH_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
      },
      ((accessToken, refreshToken, profile, done) => {
        const userEmail = profile.emails[0].value;
        db.models.User.findOne({ where: { email: userEmail } })
          .then((foundUser) => {
            if (!foundUser) {
              dbHelpers.saveMember(userEmail, null, null)
                .then((userToSave) => {
                  const options = email.signupOptions(userEmail);
                  email.sendMail(options);
                  done(null, userToSave);
                })
                .catch((err) => done(err));
              return;
            }
            done(null, foundUser);
          })
          .catch((err) => done(err));
      }),
    ));
  }

  passport.serializeUser((user, done) => {
    const id = user.id || (user.dataValues && user.dataValues.id);
    done(null, id);
  });

  passport.deserializeUser((sessionUser, done) => {
    const id = sessionUser && typeof sessionUser === 'object' ? sessionUser.id : sessionUser;
    if (!id) {
      done(null, false);
      return;
    }
    db.models.User.findByPk(id, {
      attributes: ['id', 'email', 'zipcode'],
    })
      .then((user) => {
        done(null, user ? user.get({ plain: true }) : false);
      })
      .catch((err) => done(err));
  });
};

const PRODUCTION_HOST = 'foodfight.cartertrobinson.me';

exports.googleCallbackURL = (req) => {
  const host = String((req.get('x-forwarded-host') || req.get('host') || ''))
    .split(',')[0]
    .trim();
  const hostname = host.split(':')[0];
  if (hostname === PRODUCTION_HOST || hostname.endsWith('.elb.amazonaws.com')) {
    return `https://${PRODUCTION_HOST}/auth/google/callback`;
  }
  const proto = String((req.get('x-forwarded-proto') || req.protocol || 'http'))
    .split(',')[0]
    .trim();
  return `${proto}://${host}/auth/google/callback`;
};

exports.publicUser = (user) => {
  if (!user) {
    return null;
  }
  const src = user.dataValues || user;
  return {
    id: src.id,
    email: src.email,
    zipcode: src.zipcode == null ? null : src.zipcode,
  };
};
