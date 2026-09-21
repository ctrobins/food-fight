module.exports = (sequelize, DataTypes) => {
  const RestaurantUser = sequelize.define('restaurant_user', {
    voted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  });

  RestaurantUser.associate = (models) => {
    RestaurantUser.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
    });
    RestaurantUser.belongsTo(models.User, {
      foreignKey: 'userId',
    });
  };

  return RestaurantUser;
};
