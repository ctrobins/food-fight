const { DataTypes, QueryTypes } = require('sequelize');

const timestampColumns = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
};

async function tableNames(sequelize) {
  const tables = await sequelize.getQueryInterface().showAllTables();
  return new Set(tables.map((table) => (typeof table === 'object' ? table.tableName : table)));
}

async function baseline(sequelize) {
  const qi = sequelize.getQueryInterface();
  const existing = await tableNames(sequelize);

  if (!existing.has('users')) {
    await qi.createTable('users', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: DataTypes.STRING, allowNull: false },
      password: { type: DataTypes.STRING, allowNull: true },
      zipcode: { type: DataTypes.INTEGER, allowNull: true },
      ...timestampColumns,
    });
  }

  if (!existing.has('rooms')) {
    await qi.createTable('rooms', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      uniqueid: { type: DataTypes.STRING, allowNull: false },
      zipcode: { type: DataTypes.INTEGER, allowNull: false },
      owner: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ...timestampColumns,
    });
  }

  if (!existing.has('restaurants')) {
    await qi.createTable('restaurants', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      votes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      vetoed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      roomId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'rooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ...timestampColumns,
    });
  }

  if (!existing.has('messages')) {
    await qi.createTable('messages', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: true },
      message: { type: DataTypes.STRING, allowNull: true },
      room_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'rooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ...timestampColumns,
    });
  }

  if (!existing.has('room_users')) {
    await qi.createTable('room_users', {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      room_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: { model: 'rooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ...timestampColumns,
    });
  }

  if (!existing.has('restaurant_users')) {
    await qi.createTable('restaurant_users', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      voted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      restaurantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'restaurants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ...timestampColumns,
    });
  }
}

async function dedupeRoomNames(sequelize) {
  const dupes = await sequelize.query(
    'SELECT name FROM rooms GROUP BY name HAVING COUNT(*) > 1',
    { type: QueryTypes.SELECT },
  );
  for (const dup of dupes) {
    const rows = await sequelize.query(
      'SELECT id FROM rooms WHERE name = :name ORDER BY id ASC',
      { replacements: { name: dup.name }, type: QueryTypes.SELECT },
    );
    for (const row of rows.slice(1)) {
      await sequelize.query(
        'UPDATE rooms SET name = :name WHERE id = :id',
        { replacements: { name: `${dup.name} #${row.id}`, id: row.id } },
      );
    }
  }
}

async function dedupeRestaurantNames(sequelize) {
  const dupes = await sequelize.query(
    'SELECT "roomId", name FROM restaurants GROUP BY "roomId", name HAVING COUNT(*) > 1',
    { type: QueryTypes.SELECT },
  );
  for (const dup of dupes) {
    const rows = await sequelize.query(
      `SELECT id, votes, vetoed
       FROM restaurants
       WHERE "roomId" IS NOT DISTINCT FROM :roomId AND name = :name
       ORDER BY votes DESC, id ASC`,
      {
        replacements: { roomId: dup.roomId, name: dup.name },
        type: QueryTypes.SELECT,
      },
    );
    const [keep, ...rest] = rows;
    if (!keep || rest.length === 0) {
      continue;
    }
    const votes = rows.reduce((sum, row) => sum + Number(row.votes || 0), 0);
    const vetoed = rows.some((row) => row.vetoed);
    await sequelize.query(
      'UPDATE restaurants SET votes = :votes, vetoed = :vetoed WHERE id = :id',
      { replacements: { votes, vetoed, id: keep.id } },
    );
    await sequelize.query(
      'DELETE FROM restaurant_users WHERE "restaurantId" IN (:ids)',
      { replacements: { ids: rest.map((row) => row.id) } },
    );
    await sequelize.query(
      'DELETE FROM restaurants WHERE id IN (:ids)',
      { replacements: { ids: rest.map((row) => row.id) } },
    );
  }
}

async function integrity(sequelize) {
  await sequelize.query('ALTER TABLE users ALTER COLUMN zipcode DROP NOT NULL');
  await dedupeRoomNames(sequelize);
  await dedupeRestaurantNames(sequelize);
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS rooms_name_unique ON rooms (name)');
  await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS rooms_uniqueid_unique ON rooms (uniqueid)');
  await sequelize.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS restaurants_room_name_unique ON restaurants ("roomId", name)',
  );
  await sequelize.query(
    'CREATE INDEX IF NOT EXISTS messages_room_id_index ON messages (room_id)',
  );
  await sequelize.query(`
    DELETE FROM restaurant_users
    WHERE "userId" IS NULL OR "restaurantId" IS NULL
  `);
  await sequelize.query('ALTER TABLE restaurant_users ALTER COLUMN "userId" SET NOT NULL');
  await sequelize.query('ALTER TABLE restaurant_users ALTER COLUMN "restaurantId" SET NOT NULL');
  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS restaurant_users_vote_unique
    ON restaurant_users ("userId", "restaurantId")
  `);
}

const migrations = [
  { id: '001-baseline', up: baseline },
  { id: '002-integrity', up: integrity },
];

async function migrate(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const appliedRows = await sequelize.query(
    'SELECT id FROM schema_migrations',
    { type: QueryTypes.SELECT },
  );
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    await migration.up(sequelize);
    await sequelize.query(
      'INSERT INTO schema_migrations (id) VALUES (:id)',
      { replacements: { id: migration.id } },
    );
    console.log('Applied migration', migration.id);
  }
}

module.exports = { migrate };
