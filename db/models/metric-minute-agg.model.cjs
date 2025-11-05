"use strict";
module.exports = (sequelize, Sequelize) => {
  const MetricMinuteAgg = sequelize.define(
    "MetricMinuteAggs",
    {
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
    },
    {
      tableName: "MetricMinuteAggs",
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  return MetricMinuteAgg;
};
