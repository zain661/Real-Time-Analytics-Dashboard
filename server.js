const express = require("express");
const http = require("http");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = require("./db/models");
db.sequelize.sync({ force: false });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
