const amqp = require('amqplib');
const Product = require("./models/product")

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672'

const connectToRabbitMQ = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await amqp.connect(RABBITMQ_URL);
            const channel = await connection.createChannel();

            console.log('Connected to RabbitMQ successfully.');
            connection.on('close', () => {
                console.error('Connection closed, attempting to reconnect...');
                setTimeout(() => connectToRabbitMQ(retries, delay), delay);
            })

            connection.on('error', (err) => {
                console.error('Connection error:', err);
                connection.close();
            });
            return { connection, channel };
        } catch (error) {
            console.error(`Failed to connect to RabbitMQ (attempt ${i + 1}):`, error);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                throw error; // Re-throw the error after all retries
            }
        }
    }
}

const consumeOrderPlacedEvent = async () => {

    // Declare the queue to receive messages from
    const queue = 'OrderPlaced';
    const { connection, channel } = await connectToRabbitMQ();

    await channel.assertQueue(queue, { durable: true });

    console.log(`Waiting for messages in ${queue}...`);

    // Consume messages from the queue
    channel.consume(queue, async (msg) => {
        const orderData = JSON.parse(msg.content.toString());
        const replyTo = msg.properties.replyTo;
        const correlationId = msg.properties.correlationId;
        const orderId = orderData.order.id;
  
        // Process the order to deduct stock for each product
        const success = await processOrder(orderData.order.items);

        channel.sendToQueue(
            replyTo, 
            Buffer.from(JSON.stringify({ success, orderId })), // Convert boolean to string
            {
                correlationId: correlationId
            }
        );
  
        // Acknowledge the message after successful processing
        channel.ack(msg);
    });
}


const processOrder = async (orderData) => {
    const transaction = await Product.sequelize.transaction(); // Start a transaction

    try {
        for (const orderItem of orderData) {
            const productId = orderItem.productId;
            const product = await Product.findByPk(productId, { transaction, logging: false });

            if (!product) {
                throw new Error(`Product with ID ${productId} not found`);
            }

            product.stock -= orderItem.quantity;
            await product.save({ transaction });
        }

        await transaction.commit(); // Commit the transaction if all updates succeed
        return true;
    } catch (error) {
        await transaction.rollback(); // Rollback the transaction if any update fails
        console.error('Failed to process order:', error);
        return false;
    }
}

module.exports = consumeOrderPlacedEvent;
