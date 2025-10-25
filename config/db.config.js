module.exports = {
  PORT: process.env.DB_PORT || 3306,
  HOST: process.env.DB_HOST || "127.0.0.1",
  USER: process.env.USER,
  PASSWORD: process.env.PASSWORD,
  DB: process.env.DATABASE,
  dialect: process.env.dialect || "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
