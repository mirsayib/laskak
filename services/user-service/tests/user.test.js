const request = require('supertest');
const app = require('../index'); 
const User = require('../models/user');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

describe('User Routes', () => {
    let token;
    let userId;

    beforeAll(async () => {
        // Create a user and get a token for authentication
        const user = await User.create({
            username: 'testuser',
            email: 'testuser@example.com',
            password: 'password123'
        });
        userId = user.id;
        token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        // Clean up the database
        await User.destroy({ where: {} });
    });

    describe('POST /api/users/register', () => {
        it('should register a new user', async () => {
            const response = await request(app)
                .post('/api/users/register')
                .send({
                    username: 'newuser',
                    email: 'newuser@example.com',
                    password: 'password123'
                });

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('message', 'User registered successfully');
            expect(response.body).toHaveProperty('token');
        });
    });

    describe('POST /api/users/login', () => {
        it('should login an existing user', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    email: 'newuser@example.com',
                    password: 'password123'
                });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('token');
        });
    });

    describe('GET /api/users', () => {
        it('should get all users', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update a user', async () => {
            const response = await request(app)
                .put(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'updateduser',
                    email: 'updateduser@example.com'
                });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('message', 'User updated successfully');
        });
    });

});
