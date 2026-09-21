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
    const appBaseUrl = (
      process.env.DOMAIN || `http://localhost:${process.env.PORT || 3000}`
    ).replace(/\/$/, '');
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackURL: `${appBaseUrl}/auth/google/callback`,
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
