require('dotenv').config();

const Sequelize = require('sequelize');

const { Op } = Sequelize;

const dialectOptions = {};
if (process.env.DB_SSL === 'true') {
  dialectOptions.ssl = { require: true, rejectUnauthorized: false };
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'foodfight',
  process.env.DB_USER || 'foodfight',
  process.env.DB_PASSWORD || 'foodfight',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions,
  },
);

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch((err) => {
    console.log('Unable to connect to the database:', err.message);
  });

const models = {
  User: require('./user')(sequelize, Sequelize.DataTypes),
  Room: require('./room')(sequelize, Sequelize.DataTypes),
  Restaurant: require('./restaurant')(sequelize, Sequelize.DataTypes),
  Message: require('./message')(sequelize, Sequelize.DataTypes),
  RestaurantUser: require('./restaurantUser')(sequelize, Sequelize.DataTypes),
};

Object.keys(models).forEach((modelName) => {
  if ('associate' in models[modelName]) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports.models = models;
module.exports.Op = Op;
