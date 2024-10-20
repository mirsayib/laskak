const express = require("express");
const Order = require("../models/order")
const OrderItem = require("../models/orderItem")
const axios = require("axios");
const { z } = require("zod");
const { validate: uuidValidate } = require('uuid');

const { authenticateToken, validateSchema, authorizeUser } = require("../middlewares");

const router = express.Router();

// Create a new order
router.post("/", authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const token = req.headers.authorization;
    const { address } = req.body;
    

    const transaction = await Order.sequelize.transaction(); // Start a transaction

    try {
        // Fetch user's cart
        const response = await axios.get(`${process.env.CART_SERVICE_URL}/my-cart`, {
            headers: { Authorization: token }
        });

        // Check if cart is empty
        if (response.status === 404 || !response.data || !response.data.items || response.data.items.length === 0) {
            return res.status(400).json({ error: "Your Cart is Empty! Please add items to cart to proceed" });
        }

        const cart = response.data;
        const itemsInStock = await isStockValid(cart.items);

        // Check stock availability
        if (!itemsInStock) {
            return res.status(400).json({ error: "Order can't be placed! Some of the items in your cart are out of stock!" });
        }

        // Create order within the transaction
        const order = await Order.create({
            userId: userId, cartId: cart.id, status: 'INITIATED', address
        }, { transaction });

        // Create order items within the transaction
        const orderItems = cart.items.map(item => ({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
        }));

        await OrderItem.bulkCreate(orderItems, { transaction });

        // Commit the transaction
        await transaction.commit();

        // Fetch the order with items
        const orderWithItems = await Order.findOne({
            where: { id: order.id },
            include: [{ model: OrderItem, as: 'items' }] // Include associated OrderItems as "items"
        });

        const message = "Order created! please complete the payment";
        res.status(201).json({ order: orderWithItems, message });
    } catch (error) {
        // Rollback the transaction in case of error
        await transaction.rollback();

        if (error.response) {
            console.error("HTTP error:", error.response.status, error.response.data);
            return res.status(error.response.status).json({ error: error.response.data.error || "External service error" });
        } else if (error.request) {
            console.error("Network error:", error.message);
            return res.status(503).json({ error: "Service unavailable. Please try again later." });
        } else {
            console.error("Error placing the order:", error);
            return res.status(500).json({ error: "Internal server error. Please try again later." });
        }
    }
});

// Retrieve all orders for a user
router.get("/", authenticateToken, async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { userId: req.user.id },
            include: [{ model: OrderItem, as: 'items' }] // Include associated OrderItems as "items"
        });
        res.status(200).json(orders);
    } catch (error) {
        console.error("Error retrieving orders:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

// Retrieve a specific order by ID
router.get("/:orderId", authenticateToken, async (req, res) => {
    const { orderId } = req.params;

    // Validate order ID
    if (!uuidValidate(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
        const order = await Order.findOne({
            where: { id: orderId, userId: req.user.id },
            include: [{ model: OrderItem, as: 'items' }] // Include associated OrderItems as "items"
        });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error("Error retrieving order:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

// Update an order
router.put("/:orderId", authenticateToken, async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate order ID
    if (!uuidValidate(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
        const order = await Order.findOneAndUpdate(
            { _id: orderId, userId: req.user.id },
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

// Delete an order
router.delete("/:orderId", authenticateToken, async (req, res) => {
    const { orderId } = req.params;

    // Validate order ID
    if (!uuidValidate(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
        const order = await Order.findOneAndDelete({ _id: orderId, userId: req.user.id });

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

// Deduct stock for cart items
async function deductStockForCartItems(cartItems, token) {
    try {
        for (const item of cartItems) {
            await axios.post(`${process.env.PRODUCT_SERVICE_URL}/${item.productId}/deduct-stock`, {
                quantity: item.quantity
            }, {
                headers: { Authorization: token }
            });
        }
    } catch (error) {
        console.error("Error deducting stock for cart items:", error);
        throw new Error("Failed to deduct stock for cart items");
    }
}

// Validate stock for cart items
const isStockValid = async (cartItems) => {
    try {
        for (const item of cartItems) {
            const response = await axios.get(`${process.env.PRODUCT_SERVICE_URL}/${item.productId}`);
            const product = response.data;

            if (product.stock < item.quantity) {
                console.error(`Product ${product.name} is out of stock`);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error("Error validating stock:", error);
        return false;
    }
}

// Mark payment status as complete
router.patch("/:orderId/complete-payment", authenticateToken, async (req, res) => {
    const { orderId } = req.params;

    // Validate order ID
    if (!uuidValidate(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
    }

    try {
        const [updatedRowsCount, updatedOrders] = await Order.update(
            { paymentStatus: true },
            {
                where: { id: orderId, userId: req.user.id },
                returning: true, // This option returns the updated rows
            }
        );

        const order = updatedOrders[0]; // Get the first updated order

        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ message: "Payment status updated to complete", order });
    } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

module.exports = router;
