const config = require("../../config/db.config");
const Sequelize = require("sequelize");

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect || "mysql",
  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.min,
    idle: config.pool.idle,
  },
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Server = require("./server.model")(sequelize, Sequelize);
db.MetricRaw = require("./metric-raw.model")(sequelize, Sequelize);
db.MetricMinuteAgg = require("./metric-minute-agg.model")(sequelize, Sequelize);

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

module.exports = db;
