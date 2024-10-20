const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { z } = require("zod");
const bcrypt = require("bcrypt");
const { Sequelize } = require("sequelize");
const { validate: uuidValidate } = require('uuid');

const { authenticateToken, authorizeUser, validateSchema } = require("../middlewares");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Define Zod schema for user registration
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

// Define Zod schema for user login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Update user details
router.put("/:id", authenticateToken, authorizeUser, async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        await user.update({ username, email });
        return res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: "Error updating user" });
    }
});

// Get all users
router.get("/", authenticateToken, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['username'],
            logging: false
        });
        return res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: "Error fetching users" });
    }
});

// Register a new user
router.post("/register", validateSchema(registerSchema), async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const userExists = await checkIfUserExists(email, username);

        if (userExists) {
            return res.status(400).json({ error: "Username or email already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await createUser({ username, email, password: hashedPassword });

        // Generate a token for the new user
        const token = jwt.sign({ id: user.id, name: user.username }, JWT_SECRET, { expiresIn: '1h' });

        console.log('User created successfully: ', user.username);
        return res.status(201).json({ message: 'User registered successfully', token });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: "Error creating user " + error.message });
    }
});

// User login
router.post("/login", validateSchema(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: "Error logging in" });
    }
});

// Helper function to create a user
async function createUser(userData) {
    try {
        const newUser = await User.create(userData);
        return newUser;
    } catch (error) {
        throw error;
    }
}

// Helper function to check if a user exists
async function checkIfUserExists(email, username) {
    try {
        const user = await User.findOne({
            where: {
                [Sequelize.Op.or]: [{ email: email }, { username: username }]
            }
        });

        return user !== null;
    } catch (error) {
        console.error('Error checking user existence:', error);
        throw error;
    }
}

module.exports = router;