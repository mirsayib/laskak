const express = require("express");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");
const axios = require("axios");
const { z } = require("zod");
const { validate: uuidValidate } = require('uuid');

const { authenticateToken, validateSchema, authorizeUser } = require("../middlewares");

const router = express.Router();

// Add item to cart
router.post("/", authenticateToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user.id;

        // Fetch product details
        let product;
        try {
            const response = await axios.get(`${process.env.PRODUCT_SERVICE_URL}/${productId}`);
            if (response.status === 404) {
                throw new Error("Product not found");
            }
            product = response.data;
        } catch (error) {
            console.error('Error fetching product:', error);
            return res.status(404).json({ error: error.message || "Product not found or unavailable" });
        }

        // Check stock availability
        if (!product || product.stock < quantity) {
            return res.status(400).json({ error: "Product not available in the requested quantity" });
        }

        let cart = await Cart.findOne({where: { userId }});

        if(!cart) {
            cart = await Cart.create({ userId });
        }

        const cartItem = await CartItem.create({
            productId: product.id,
            quantity: quantity,
            cartId: cart.id,
            price: product.price
        });

        res.status(201).json(cartItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while adding the item to the cart." });
    }
});

// Get all items in the cart
router.get("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const cart = await Cart.findOne({
            where: { userId },
            include: [{ model: CartItem, as: 'items' }]
        });

        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        res.status(200).json(cart.items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while retrieving the cart items." });
    }
});

// Remove an item from the cart
router.delete("/:itemId", authenticateToken, authorizeUser, async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user.id;

        if(!uuidValidate(userId)){
            return res.status(404).json({ error: "Cart not found." });
        }

        const cart = await Cart.findOne({ where: { userId } });

        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        const cartItem = await CartItem.findOne({ where: { id: itemId, cartId: cart.id } });

        if (!cartItem) {
            return res.status(404).json({ error: "Cart item not found." });
        }

        await cartItem.destroy();
        res.status(200).json({ message: "Cart item removed successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the cart item." });
    }
});

// Clear all items from the cart
router.delete("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ where: { userId } });

        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        await CartItem.destroy({ where: { cartId: cart.id } });
        res.status(200).json({ message: "Cart cleared successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while clearing the cart." });
    }
});

// Get cart of authenticated user
router.get("/my-cart", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({
            where: { userId },
            include: [{ model: CartItem, as: 'items' }]
        });

        if (!cart) {
            return res.status(404).json({ error: "Cart not found." });
        }

        res.status(200).json(cart);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while retrieving the cart." });
    }
});

module.exports = router;