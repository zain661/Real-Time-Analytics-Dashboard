"use strict";
module.exports = (sequelize, Sequelize) => {
  const Server = sequelize.define(
    "Servers",
    {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      hostname: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      meta: {
        type: Sequelize.JSON,
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
      tableName: "Servers",
      timestamps: true,
      paranoid: true,
      underscored: true,
    }
  );

  return Server;
};
