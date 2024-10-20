const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    orderId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    paymentStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: false
    },
    method: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: false
    }
});

// Export the model without associations
module.exports = Payment;
