module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zipcode: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  User.associate = (models) => {
    User.belongsToMany(models.Room, {
      through: 'room_users',
      foreignKey: 'user_id',
    });
    User.belongsToMany(models.Restaurant, {
      through: models.RestaurantUser,
      foreignKey: 'userId',
      otherKey: 'restaurantId',
    });
  };

  return User;
};
