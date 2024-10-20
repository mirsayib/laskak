const express = require('express');
const sequelize = require('./config/db');
const cartRoutes = require("./routes/cart")

const Cart = require('./models/cart');
const CartItem = require('./models/cartItem');

const dotenv = require('dotenv');
dotenv.config();

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/cart", cartRoutes)


// Set up associations
Cart.hasMany(CartItem, {
    foreignKey: 'cartId',
    as: 'items',
    onDelete: 'CASCADE',
});

CartItem.belongsTo(Cart, {
    foreignKey: 'cartId',
    as: 'cart',
    onDelete: 'CASCADE',
});

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

const PORT = process.env.PORT || 5002;

// Start server after successful database connection
retryDatabaseConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
});
