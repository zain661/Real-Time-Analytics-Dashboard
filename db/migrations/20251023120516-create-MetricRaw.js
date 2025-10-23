"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MetricRaw", {
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
      value: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      labels: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      ts: {
        type: Sequelize.DATE(6),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex("MetricRaw", [
      "server_id",
      "metric_name",
      "ts",
    ]);
    await queryInterface.addIndex("MetricRaw", ["ts"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MetricRaw");
  },
};
