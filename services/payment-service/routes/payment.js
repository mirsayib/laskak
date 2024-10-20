const express = require("express");
const Payment = require("../models/payment")
const axios = require("axios");
const { z } = require("zod");
const { validate: uuidValidate } = require('uuid');

const { authenticateToken, validateSchema, authorizeUser } = require("../middlewares");
const publishPaymentDoneEvent = require("../eventPublisher");

const router = express.Router();

// make a payment for given order 
router.post("/", authenticateToken, async (req, res) => {
    const { orderId, paymentMethod } = req.body;

    // Validate orderId
    if (!uuidValidate(orderId)) {
        return res.status(400).json({ error: "Invalid orderId" });
    }
    
    try {
        const amount = await calculateAmount(orderId, req.headers.authorization);
        const payment = await Payment.create({
            orderId: orderId,
            method: paymentMethod,
            paymentStatus: "INITIATED"
        })

        // Create a new payment record using Sequelize
        

        // // Simulate payment processing with an external service
        // const response = await axios.post("https://payment-gateway.example.com/process", {
        //     orderId,
        //     amount,
        //     paymentMethod
        // });

        // Update payment status based on the response
        if (true) {
            payment.paymentStatus = "PAID";
            await payment.save();
            await publishPaymentDoneEvent(payment);

            res.status(200).json({ message: "Payment processed successfully", payment });
        } else {
            res.status(400).json({ message: "Payment failed", payment });
        }
        
    } catch (error) {
        console.error("Payment processing error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get payment by ID
router.get("/:paymentId", authenticateToken, async (req, res) => {
    const { paymentId } = req.params;

    try {
        // Find the payment record by ID
        const payment = await Payment.findByPk(paymentId);

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        res.status(200).json(payment);
    } catch (error) {
        console.error("Error retrieving payment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


async function calculateAmount(orderId, authorizationHeader) {
    // Retrieve the order object
    const orderResponse = await axios.get(`${process.env.ORDER_SERVICE_URL}/${orderId}`, {
        headers: { Authorization: authorizationHeader }
    });

    const order = orderResponse.data;
    
    // Calculate the total amount
    return order.items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

module.exports = router;
