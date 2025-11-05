// Load environment variables from .env file (only needed for local development)
require('dotenv').config();

module.exports = {
  HOST: process.env.DB_HOST || "127.0.0.1",
  PORT: parseInt(process.env.DB_PORT) || 3306,  // ← Fixed: was using wrong variable
  USER: process.env.DB_USER || "root",          // ← Fixed: now reads DB_USER
  PASSWORD: process.env.DB_PASSWORD || "قخخف",  // ← Fixed: now reads DB_PASSWORD
  DB: process.env.DB_NAME || "real_time_analytics_dashboard", // ← Fixed: now reads DB_NAME
  dialect: process.env.DB_DIALECT || "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};