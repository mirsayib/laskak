const express = require("express");
const { z } = require("zod");
const Product = require("../models/product");
const { validate: uuidValidate } = require('uuid');

const { authenticateToken, validateSchema, authorizeUser } = require("../middlewares");

const router = express.Router();

// Schema for creating a product
const createProductSchema = z.object({
  name: z.string().min(3).max(50),
  price: z.number().positive(),
  description: z.string().optional(),
  stock: z.number().int().positive(), 
});

// Schema for deducting stock
const deductStockSchema = z.object({
  quantity: z.number().int().positive(),
});

// Get all products
router.get("/", async (req, res) => {
    try {
        const products = await Product.findAll({logging: false});
        return res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ error: "Error fetching products" });
    }
});

// Create a new product
router.post("/", authenticateToken, validateSchema(createProductSchema), async (req, res) => {
    try {
        const { name, price, description, stock } = req.body;

        // Check if product name already exists
        const nameExists = await checkIfProductNameExists(name);
        if (nameExists) {
            return res.status(400).json({ error: "Product name already exists" });
        }

        const userId = req.user.id;

        // Create the product
        const product = await createProduct({ 
            name, 
            price, 
            description, 
            stock, 
            userId 
        });

        return res.status(201).json({ message: 'Product added successfully', product });
    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({ error: "Error creating the product " + error.message });
    }
});

// Get a product by ID
router.get("/:id", async (req, res) => {
    try {
        const productId = req.params.id;

        // Validate productId
        if (!uuidValidate(productId)) {
            return res.status(404).json({ error: "Product not found" });
        }

        const product = await Product.findByPk(productId, { logging: false });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        return res.json(product);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        return res.status(500).json({ error: "Error fetching product" });
    }
});

// Helper function to create a product
async function createProduct({ name, price, description, stock, userId }) {
    try {
        const newProduct = await Product.create({
            name,
            description,
            price,
            stock,
            userId
        });
        
        return newProduct;
    } catch (error) {
        console.error('Error creating product:', error);
        throw new Error('Failed to create product. Please try again later.'); 
    }
}

// Helper function to check if a product name exists
async function checkIfProductNameExists(name) {
    try {
        const product = await Product.findOne({
            where: { name } 
        });

        return product !== null;
    } catch (error) {
        console.error('Error checking product name existence:', error);
        throw error;
    }
}

// Deduct stock for a product
router.post("/:id/deduct-stock", authenticateToken, authorizeUser, validateSchema(deductStockSchema), async (req, res) => {
    try {
        const productId = req.params.id;
        const { quantity } = req.body;

        // Validate productId
        if (!uuidValidate(productId)) {
            return res.status(404).json({ error: "Product not found" });
        }

        const product = await Product.findByPk(productId, { logging: false });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Check stock availability
        if (product.stock < quantity) {
            return res.status(400).json({ error: "Insufficient stock" });
        }

        // Deduct stock
        product.stock -= quantity;
        await product.save();

        return res.json({ message: 'Stock deducted successfully', product });
    } catch (error) {
        console.error('Error deducting stock:', error);
        return res.status(500).json({ error: "Error deducting stock" });
    }
});

module.exports = router;