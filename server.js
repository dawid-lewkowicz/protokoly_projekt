const express = require("express"); // tworzy serwet HTTP(API)
const sqlite3 = require("sqlite3").verbose(); // obsługuje bazę danych w pliku
const bodyParser = require("body-parser");
const path = require("path"); // zamiana / na \ zależnie od systemu
const http = require("http");
const { Server } = require("socket.io"); //obsługuje WebSockety(komunikacja na żywo)
const mqtt = require("mqtt"); // pozwala komunikowac sie z MQTT

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./database.db", (err) => {
  if (err) console.error(err.message);
  console.log("Połączono z bazą SQLite.");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        sender TEXT
    )`);
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  // przyszłe szyfrowanie
  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, username });
    },
  );
});

app.get("/api/messages", (req, res) => {
  const search = req.query.search || "";
  const sql = `SELECT * FROM messages WHERE content LIKE ?`;
  db.all(sql, [`%${search}%`], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/messages", (req, res) => {
  const { content, sender } = req.body;
  db.run(
    `INSERT INTO messages (content, sender) VALUES (?, ?)`,
    [content, sender],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const newMsg = { id: this.lastID, content, sender };
      io.emit("chat_message", newMsg);

      res.json(newMsg);
    },
  );
});

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("Połączono z brokerem MQTT");

  mqttClient.subscribe("moj_projekt_studia/status");

  setInterval(() => {
    const statusMsg = "System OK: " + new Date().toLocaleTimeString();
    mqttClient.publish("moj_projekt_studia/status", statusMsg);
    console.log("MQTT: Wysłano status do brokera");
  }, 10 * 1000);
});

mqttClient.on("message", (topic, message) => {
  console.log(
    `MQTT: Odebrano wiadomość na temacie [${topic}]: ${message.toString()}`,
  );
});
server.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
