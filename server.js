const express = require("express"); // tworzy serwet HTTP(API)
const sqlite3 = require("sqlite3").verbose(); // obsługuje bazę danych w pliku
const bodyParser = require("body-parser"); //tłumacz języka JSON
const http = require("http");
const { Server } = require("socket.io"); //obsługuje WebSockety(komunikacja na żywo)
const mqtt = require("mqtt"); // pozwala komunikowac sie z MQTT
const bcrypt = require("bcrypt"); // hashowanie haseł

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

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

  db.run(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reported_user TEXT,
        reason TEXT
  )`);
});

// CREATE

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const salt = 10;
    const hashedPassword = await bcrypt.hash(password, salt);

    db.run(
      `INSERT INTO users (username, password) VALUES (?, ?)`,
      [username, hashedPassword],
      function (err) {
        if (err)
          return res
            .status(400)
            .json({ error: "Użytkownik już istnieje lub błąd bazy" });
        res.json({ id: this.lastID, username });
      },
    );
  } catch (err) {
    res.status(500).json({ error: "Błąd serwera przy szyfrowaniu" });
  }
});

app.post("/api/feedback", (req, res) => {
  const { content } = req.body;
  const date = new Date().toLocaleString();

  db.run(
    `INSERT INTO feedback (content, date) VALUES (?, ?)`,
    [content, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Dziękujemy za opinię!", id: this.lastID });
      console.log("Dodano nową opinię do bazy.");
    },
  );
});

app.post("/api/reports", (req, res) => {
  const { reportedUser, reason } = req.body;

  db.run(
    `INSERT INTO reports (reported_user, reason) VALUES (?, ?)`,
    [reportedUser, reason],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        message: `Zgłoszenie na użytkownika ${reportedUser} przyjęte.`,
        id: this.lastID,
      });
      console.log(`Zgłoszono użytkownika: ${reportedUser}`);
    },
  );
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

// READ

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    async (err, user) => {
      if (err || !user)
        return res.status(400).json({ error: "Nie znaleziono użytkownika" });

      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.json({ message: "Zalogowano pomyślnie", username: user.username });
      } else {
        res.status(401).json({ error: "Błędne hasło" });
      }
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

app.get("/api/users", (req, res) => {
  const sql = "SELECT username FROM users";

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/my-messages", (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "Podaj parametr username!" });
  }
  const sql = "SELECT * FROM messages WHERE sender = ?";

  db.all(sql, [username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/logout", (req, res) => {
  res.json({ message: "Wylogowano pomyślnie" });
});

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("Połączono z brokerem MQTT");

  mqttClient.subscribe("moj_projekt/status");

  setInterval(() => {
    const statusMsg = "System OK: " + new Date().toLocaleTimeString();
    mqttClient.publish("moj_projekt/status", statusMsg);
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
