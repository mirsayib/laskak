const dotenv = require("dotenv");
const { Sequelize } = require('sequelize');

dotenv.config();

const sequelize = new Sequelize(process.env.POSTGRES_URI, {
    dialect: 'postgres',
    logging: false
});

module.exports = sequelize;
