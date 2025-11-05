const config = require("../../config/db.config.cjs");
const Sequelize = require("sequelize");

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  port: config.PORT,
  dialect: config.dialect || "mysql",
  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.min,
    idle: config.pool.idle,
  },
  dialectOptions: {
    connectTimeout: 60000, // 60 seconds
  },
  retry: {
    max: 3,
  },
});

// Test Database Connection
// ============================================
console.log('🔌 Attempting database connection...');
console.log('   Host:', config.HOST);
console.log('   Port:', config.PORT);
console.log('   User:', config.USER);
console.log('   Database:', config.DB);

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected successfully!');
  })
  .catch(err => {
    console.error('❌ Database connection failed!');
    console.error('   Error:', err.message);
    console.error('   Check your credentials and ensure MySQL is running');
    // Don't exit - let the app continue (it will retry on each query)
  });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Server = require("./server.model.cjs")(sequelize, Sequelize);
db.MetricRaw = require("./metric-raw.model.cjs")(sequelize, Sequelize);
db.MetricMinuteAgg = require("./metric-minute-agg.model.cjs")(sequelize, Sequelize);

// ======================
// Define Relationships
// ======================

// One Server → Many MetricRaw
db.Server.hasMany(db.MetricRaw, {
  foreignKey: "server_id",
  sourceKey: "id",
  onDelete: "CASCADE",
});
db.MetricRaw.belongsTo(db.Server, {
  foreignKey: "server_id",
  targetKey: "id",
});

// One Server → Many MetricMinuteAgg
db.Server.hasMany(db.MetricMinuteAgg, {
  foreignKey: "server_id",
  sourceKey: "id",
  onDelete: "CASCADE",
});
db.MetricMinuteAgg.belongsTo(db.Server, {
  foreignKey: "server_id",
  targetKey: "id",
});

// Sync Database (Create tables if needed)
// ============================================
// This will create tables automatically on startup
sequelize.sync({ alter: false }) // Set to true to auto-update tables (careful in production!)
  .then(() => {
    console.log('✅ Database tables synchronized');
  })
  .catch(err => {
    console.error('❌ Failed to sync database tables:', err.message);
  });

module.exports = db;
