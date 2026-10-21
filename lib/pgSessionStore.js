const session = require('express-session');
const { Pool } = require('pg');

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

class PgSessionStore extends session.Store {
  constructor() {
    super();
    const poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'foodfight',
      user: process.env.DB_USER || 'foodfight',
      password: process.env.DB_PASSWORD || 'foodfight',
    };
    if (process.env.DB_SSL === 'true') {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    this.pool = new Pool(poolConfig);
  }

  get(sid, callback) {
    this.pool.query(
      'SELECT sess FROM user_sessions WHERE sid = $1 AND expire > NOW()',
      [sid],
    ).then((result) => {
      callback(null, result.rows[0] ? result.rows[0].sess : null);
    }).catch(callback);
  }

  set(sid, sess, callback) {
    const maxAge = sess.cookie && sess.cookie.maxAge;
    const expire = new Date(Date.now() + (maxAge || WEEK_MS));
    this.pool.query(
      `INSERT INTO user_sessions (sid, sess, expire)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
      [sid, JSON.stringify(sess), expire],
    ).then(() => callback()).catch(callback);
  }

  destroy(sid, callback) {
    this.pool.query('DELETE FROM user_sessions WHERE sid = $1', [sid])
      .then(() => callback())
      .catch(callback);
  }
}

module.exports = { PgSessionStore };
