const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const CartItem = require('./cartItem');

const Cart = sequelize.define('Cart', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    }
});

// Export the model without associations
module.exports = Cart;
