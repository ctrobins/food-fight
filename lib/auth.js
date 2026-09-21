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
      console.log('REQUEST', req.body);
      db.models.User.findOne({ where: { email: username } })
        .then((foundUser) => {
          if (!foundUser) {
            dbHelpers.saveMember(username, password, req.body.zip, (userToSave) => {
              done(null, userToSave.dataValues);
            });
            const options = email.signupOptions(username);
            email.sendMail(options);
          } else {
            done('error');
          }
        });
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
          if (foundUser) {
            bcrypt.compare(password, foundUser.dataValues.password)
              .then((valid) => {
                console.log('VALID PASSWORD', valid);
                if (valid) {
                  done(null, foundUser.dataValues);
                } else {
                  done(null, false);
                }
              })
              .catch(console.log);
          } else {
            done(null, false);
          }
        });
    }),
  ));

  if (process.env.GOOGLE_AUTH_CLIENT_ID && process.env.GOOGLE_AUTH_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
        callbackURL: `${(process.env.DOMAIN || 'http://localhost:3000').replace(/\/$/, '')}/auth/google/callback`,
      },
      ((accessToken, refreshToken, profile, done) => {
        const userEmail = profile.emails[0].value;
        db.models.User.findOne({ where: { email: userEmail } })
          .then((foundUser) => {
            if (!foundUser) {
              dbHelpers.saveMember(userEmail, null, 78702, (userToSave) => {
                done(null, userToSave.dataValues);
              });
              const options = email.signupOptions(userEmail);
              email.sendMail(options);
              console.log('Welcome email sent to ', userEmail);
            } else {
              done(null, foundUser.dataValues);
            }
          })
          .catch(console.log);
      }),
    ));
  }

  passport.serializeUser((user, done) => {
    console.log('SERIALIZE USER\n', user);
    done(null, user);
  });

  passport.deserializeUser((obj, done) => {
    console.log('DESERIALIZE USER\n');
    done(null, obj);
  });
};
