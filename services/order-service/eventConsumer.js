const amqp = require('amqplib');
const Order = require("./models/order");
const OrderItem = require('./models/orderItem');

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

const consumePaymentDoneEvent = async () => {
    const queue = 'PaymentDone';
    const { connection, channel } = await connectToRabbitMQ();

    await channel.assertQueue(queue, { durable: true });

    console.log(`Waiting for messages in ${queue}...`);

    channel.consume(queue, async (msg) => {
        const paymentData = JSON.parse(msg.content.toString());
        const replyTo = msg.properties.replyTo;
        const {order, success} = await processPayment(paymentData);


        if(success) {
            const newEventQueue = 'OrderPlaced';
            const replyQueue = 'OrderPlacedReply';
            const orderProcessedEvent = {
                order
            }

            channel.assertQueue(replyQueue, {durable: true});

            channel.consume(replyQueue, async (msg) => {
                console.log("Reply From OrderPlaced Event!");
                const ackData = JSON.parse(msg.content.toString());
                const orderId = ackData.orderId;

                if(!ackData.success){
                    console.error("Could not deduct the product quantity from stock! Order Deleted! Please check product service logs! ");
                    await deleteOrder(orderId);;
                }

                channel.ack(msg);
            });

            channel.assertQueue(newEventQueue, { durable: true });

            channel.sendToQueue(
                newEventQueue,
                Buffer.from(JSON.stringify(orderProcessedEvent)),
                {
                    persistent: true,
                    replyTo: replyQueue,
                }
            );
            

        }

        channel.sendToQueue(
            replyTo, 
            Buffer.from(JSON.stringify({ success, paymentData })), // Convert boolean to string
        );

        channel.ack(msg);
    })
}

const processPayment = async (paymentData) => {
    const orderId = paymentData.orderId;

    try {
        const order = await Order.findByPk(orderId, {
            include: [{ model: OrderItem, as: 'items' }], // Assuming 'Item' is the model and 'items' is the alias
            logging: false
        });

        if (!order) {
            throw new Error(`Order with ID ${orderId} not found!`);
        }

        order.status = "PAYMENT_PROCESSED";
        await order.save();

        return { order: order, success: true };

    } catch (error) {
        console.error('Failed to process payment');
        return { order: null, success: false };
    }
}

module.exports = consumePaymentDoneEvent;
