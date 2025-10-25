const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const db = require("../../db/models");
const Server = db.Server;

const serverSchema = Joi.object({
  hostname: Joi.string().max(255).allow(null, ""),
  tags: Joi.object().optional(),
  meta: Joi.object().optional(),
});

exports.createServer = async (req, res) => {
  try {
    const { error, value } = serverSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const id = uuidv4();
    const server = await Server.create({
      id,
      hostname: value.hostname || null,
      tags: value.tags || null,
      meta: value.meta || null,
    });

    return res.status(201).json({ message: "Server created", data: server });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.listServers = async (req, res) => {
  try {
    const servers = await Server.findAll({ order: [["created_at", "DESC"]] });
    return res.json({ data: servers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getServer = async (req, res) => {
  try {
    const { id } = req.params;
    const server = await Server.findByPk(id);
    if (!server) return res.status(404).json({ message: "Server not found" });
    return res.json({ data: server });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateServer = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = serverSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // Build update object dynamically to avoid overwriting fields with null
    const updateData = {};
    if (value.hostname !== undefined) updateData.hostname = value.hostname;
    if (value.tags !== undefined) updateData.tags = value.tags;
    if (value.meta !== undefined) updateData.meta = value.meta;

    const [updated] = await Server.update(updateData, { where: { id } });

    if (!updated) return res.status(404).json({ message: "Server not found" });

    const server = await Server.findByPk(id);
    return res.json({ message: "Server updated", data: server });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteServer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Server.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ message: "Server not found" });
    return res.json({ message: "Server deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
