const db = require('../database-postgresql/models');
const bcrypt = require('bcrypt');
const uniqueString = require('unique-string');

const httpError = (status, message, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const saveMember = async (email, password, zipcode) => {
  let hashedPW = null;
  if (password) {
    const salt = bcrypt.genSaltSync(3);
    hashedPW = bcrypt.hashSync(password, salt);
  }
  const normalizedZip = zipcode == null || zipcode === '' ? null : zipcode;
  return db.models.User.create({
    email,
    password: hashedPW,
    zipcode: normalizedZip,
  });
};

const saveRoomAndMembers = async (roomName, zip, members, ownerId) => {
  const name = String(roomName || '').trim();
  if (!name) {
    throw httpError(400, 'Room name is required');
  }
  if (!/^\d{5}$/.test(String(zip || '').trim())) {
    throw httpError(400, 'A valid 5-digit zip code is required');
  }
  if (!ownerId) {
    throw httpError(401, 'Log in to create a room');
  }

  const emails = [...new Set((members || []).map((email) => String(email || '').trim()).filter(Boolean))];
  const owner = await db.models.User.findByPk(ownerId);
  if (!owner) {
    throw httpError(401, 'Log in to create a room');
  }
  if (!emails.includes(owner.email)) {
    emails.push(owner.email);
  }

  const users = await Promise.all(emails.map((email) => db.models.User.findOne({ where: { email } })));
  const missing = emails.filter((email, index) => !users[index]);
  if (missing.length) {
    throw httpError(400, 'Some invited members do not have accounts', { missing });
  }

  const existing = await db.models.Room.findOne({ where: { name } });
  if (existing) {
    throw httpError(409, 'A room with that name already exists');
  }

  try {
    const room = await db.models.sequelize.transaction(async (transaction) => {
      const created = await db.models.Room.create({
        name,
        uniqueid: uniqueString(),
        zipcode: Number(zip),
        owner: owner.id,
      }, { transaction });
      await created.addUsers(users, { transaction });
      return created;
    });
    return room.get({ plain: true });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw httpError(409, 'A room with that name already exists');
    }
    throw error;
  }
};

const saveMessage = async (name, message, roomID) => {
  const room = await db.models.Room.findOne({
    where: { uniqueid: roomID },
    attributes: ['id'],
  });
  if (!room) {
    throw httpError(404, 'Room not found');
  }
  const savedMessage = await db.models.Message.create({
    name,
    message,
    room_id: room.id,
  });
  return savedMessage.get({ plain: true });
};

const getMessages = async (roomID) => db.models.Message.findAll({
  attributes: ['name', 'message'],
  include: [{
    model: db.models.Room,
    where: { uniqueid: roomID },
    attributes: [],
  }],
  raw: true,
});

const getRoomMembers = async (roomID) => db.models.User.findAll({
  attributes: ['email', 'zipcode'],
  include: [{
    model: db.models.Room,
    where: { uniqueid: roomID },
    attributes: ['name', 'zipcode'],
    through: { attributes: [] },
  }],
});

const findRoomByUniqueId = async (roomID) => {
  const room = await db.models.Room.findOne({
    where: { uniqueid: roomID },
    attributes: ['id'],
  });
  if (!room) {
    throw httpError(404, 'Room not found');
  }
  return room;
};

const findRestaurantInRoom = async (restaurantId, roomID) => {
  const id = Number(restaurantId);
  if (!Number.isInteger(id)) {
    throw httpError(400, 'A restaurant id is required');
  }
  const room = await findRoomByUniqueId(roomID);
  const restaurant = await db.models.Restaurant.findOne({
    where: {
      id,
      roomId: room.id,
    },
  });
  if (!restaurant) {
    throw httpError(404, 'Restaurant not found in this room');
  }
  return restaurant;
};

const saveRestaurant = async (name, roomID) => {
  const restaurantName = String(name || '').trim();
  if (!restaurantName) {
    throw httpError(400, 'Restaurant name is required');
  }
  const room = await findRoomByUniqueId(roomID);
  const [restaurant, created] = await db.models.Restaurant.findOrCreate({
    where: {
      name: restaurantName,
      roomId: room.id,
    },
    defaults: {
      name: restaurantName,
      roomId: room.id,
    },
  });
  if (!created && restaurant.vetoed) {
    await restaurant.update({ vetoed: false });
  }
  return restaurant.get({ plain: true });
};

const updateVotes = async (restaurantId, roomID, userId) => {
  if (!userId) {
    throw httpError(401, 'Log in to vote');
  }
  const restaurant = await findRestaurantInRoom(restaurantId, roomID);

  try {
    await db.models.sequelize.transaction(async (transaction) => {
      const [record, created] = await db.models.RestaurantUser.findOrCreate({
        where: {
          userId,
          restaurantId: restaurant.id,
        },
        defaults: {
          voted: true,
        },
        transaction,
      });
      if (!created && record.voted) {
        throw httpError(409, 'You already voted for this restaurant');
      }
      if (!created) {
        await record.update({ voted: true }, { transaction });
      }
      await restaurant.increment('votes', { transaction });
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw httpError(409, 'You already voted for this restaurant');
    }
    throw error;
  }

  return restaurant.reload().then((updated) => updated.get({ plain: true }));
};

const updateVetoes = async (restaurantId, roomID) => {
  const restaurant = await findRestaurantInRoom(restaurantId, roomID);
  await restaurant.update({ vetoed: true });
  return restaurant.get({ plain: true });
};

const getScoreboard = async (roomID, userId) => {
  const scores = await db.models.Restaurant.findAll({
    attributes: ['id', 'name', 'votes', 'vetoed'],
    include: [{
      model: db.models.Room,
      where: { uniqueid: roomID },
      attributes: [],
    }],
  });
  let votedIds = new Set();
  if (userId && scores.length) {
    const votes = await db.models.RestaurantUser.findAll({
      where: {
        userId,
        voted: true,
        restaurantId: scores.map((score) => score.id),
      },
    });
    votedIds = new Set(votes.map((vote) => vote.restaurantId));
  }
  return scores.map((score) => ({
    id: score.id,
    name: score.name,
    votes: score.votes,
    vetoed: score.vetoed,
    votedByMe: votedIds.has(score.id),
  }));
};

module.exports = {
  saveMember,
  saveRoomAndMembers,
  getRoomMembers,
  saveRestaurant,
  updateVotes,
  updateVetoes,
  getScoreboard,
  saveMessage,
  getMessages,
};
