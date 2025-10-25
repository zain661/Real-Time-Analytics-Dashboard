"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MetricMinuteAggs", {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      server_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: {
          model: "Servers",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      metric_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      ts_min: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      sum: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      min: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      max: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      p95: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Unique constraint for one record per server-metric-minute
    await queryInterface.addConstraint("MetricMinuteAggs", {
      fields: ["server_id", "metric_name", "ts_min"],
      type: "unique",
      name: "unique_server_metric_minute",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MetricMinuteAggs");
  },
};
