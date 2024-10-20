const amqp = require('amqplib');
const Payment = require('./models/payment');


const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const connectToRabbitMQ = async (retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await amqp.connect(RABBITMQ_URL);
            const channel = await connection.createChannel();

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

const publishPaymentDoneEvent = async (paymentData) => {
    try {
        const { connection, channel } = await connectToRabbitMQ();
        const queue = 'PaymentDone'
        const replyQueue = 'PaymentDoneReply'

        await channel.assertQueue(queue, { durable: true });
        await channel.assertQueue(replyQueue, { durable: true });

        channel.consume(replyQueue, async (msg) => {
            console.log("Acknowledgement Received", msg.content.toString());
            
            try {
                const ackData = JSON.parse(msg.content.toString());
                const replyData = ackData.paymentData;

                if (ackData.success) {
                    // mark payment succeeded
                    const payment = await Payment.findByPk(replyData.id);
                    payment.paymentStatus = "COMPLETED";
                    await payment.save();
                }
            } catch (error) {
                console.error("Error processing acknowledgment message:", error);
            }
            
            channel.ack(msg);
        }
    )


        channel.sendToQueue(
            queue,
            Buffer.from(JSON.stringify(paymentData)),
            {
                persistent: true,
                replyTo: replyQueue
            }
        );

        console.log('PaymentDone event published!');
        setTimeout(() => connection.close(), 500);
    } catch (error) {
        console.error('Failed to publish PaymentDone event!');
    }
    
}

module.exports = publishPaymentDoneEvent;
