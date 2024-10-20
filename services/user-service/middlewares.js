// middlewares.js

const jwt = require("jsonwebtoken");
const { z } = require("zod");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

function authorizeUser(req, res, next) {
    const userId = req.params.id;
    if (req.user.id !== userId) {
        return res.status(403).json({ error: "You are not authorized to update this user" });
    }
    next();
}

// Middleware for Zod validation
function validateSchema(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: "Validation error", details: error.errors });
            }
            next(error);
        }
    };
}

module.exports = {
    authenticateToken,
    authorizeUser,
    validateSchema
};