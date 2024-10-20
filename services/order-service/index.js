const express = require('express');
const sequelize = require('./config/db');
const orderRoutes = require("./routes/order");
const Order = require("./models/order");
const OrderItem = require("./models/orderItem");


const dotenv = require('dotenv');
const consumePaymentDoneEvent = require('./eventConsumer');
dotenv.config();

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/order", orderRoutes)

// Set up associations
Order.hasMany(OrderItem, {
    foreignKey: 'orderId',
    as: 'items',
    onDelete: 'CASCADE',
});

OrderItem.belongsTo(Order, {
    foreignKey: 'orderId',
    as: 'order',
    onDelete: 'CASCADE',
});


consumePaymentDoneEvent();
// Sync models with the database
const PORT = process.env.PORT || 5003;

// Retry logic for database connection
const retryDatabaseConnection = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.sync({ logging: false });
            console.log('✅ Database synced successfully');
            return;
        } catch (err) {
            console.error(`❌ Unable to sync the database. Attempt ${i + 1} of ${retries}`);
            console.error('   Error details:', err.message);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.error('   Stack trace:', err.stack);
                process.exit(1);
            }
        }
    }
};

// Start server after successful database connection
retryDatabaseConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
});
