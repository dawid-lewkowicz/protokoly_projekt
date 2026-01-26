const express = require("express"); // tworzy serwer HTTP(API)
const sqlite3 = require("sqlite3").verbose(); // obsługuje bazę danych w pliku
const bodyParser = require("body-parser"); //tłumacz języka JSON
const http = require("http");
const { Server } = require("socket.io"); //obsługuje WebSockety(komunikacja na żywo)
const mqtt = require("mqtt"); // pozwala komunikowac sie z MQTT
const bcrypt = require("bcrypt"); // hashowanie haseł
const fs = require("fs"); // zapisywanie logow w pliku

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(bodyParser.json()); // wysyłanie danych w formacie JSON pod zmienną req.body
app.use(express.static("public"));

function logToFile(message) {
  const time = new Date().toLocaleString();
  const logMessage = `[${time}] ${message}\n`;

  // dopisywanie logow na koncu pliku
  fs.appendFile("server.log", logMessage, (err) => {
    if (err) console.error("Błąd zapisu logów:", err);
  });
}

const db = new sqlite3.Database("./database.db", (err) => {
  if (err) console.error(err.message);
  const msg = "Połączono z bazą SQLite.";
  console.log(msg);
  logToFile(msg);
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
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, password) VALUES (?, ?)`,
      [username, hashedPassword],
      function (err) {
        if (err) return res.status(400).json({ error: "Błąd bazy" });
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
  mqttClient.publish(
    "moj_projekt/alerts",
    `Zgłoszono uzytkownika: ${reportedUser}`,
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
        logToFile(`Użytkownik ${user.username} zalogował się.`);
        res.json({
          message: "Zalogowano pomyślnie",
          username: user.username,
          id: user.id,
        });
      } else {
        res.status(401).json({ error: "Błędne hasło" });
      }
    },
  );
});

// READ

app.get("/api/messages", (req, res) => {
  // przykład adresu: http://localhost:3000/api/messages?search=witam
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

app.get("/api/feedback", (req, res) => {
  const sql = "SELECT * FROM feedback";

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/reports", (req, res) => {
  const sql = "SELECT * FROM reports";

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// UPDATE

app.put("/api/messages/:id", (req, res) => {
  const id = req.params.id;
  const { content } = req.body;

  db.run(
    `UPDATE messages SET content = ? WHERE id = ?`,
    [content, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Nie znaleziono wiadomości" });

      res.json({ message: "Zaktualizowano wiadomość", id: id });
      io.emit("message_updated", { id, content });
    },
  );
});

app.put("/api/users/:id/password", async (req, res) => {
  const id = req.params.id;
  const { newPassword } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0)
          return res.status(404).json({ error: "Nie znaleziono użytkownika" });
        res.json({ message: "Hasło zostało zmienione pomyślnie." });
        logToFile(`Użytkownik ${id} zmienił hasło`);
      },
    );
  } catch (err) {
    res.status(500).json({ error: "Błąd serwera przy  szyfrowaniu" });
  }
});

app.put("/api/reports/:id", (req, res) => {
  const id = req.params.id;
  const { reason } = req.body;

  db.run(
    `UPDATE reports SET reason = ? WHERE id = ?`,
    [reason, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Nie znaleziono zgłoszenia" });
      res.json({ message: "Zaktualizowano powód zgłoszenia", id: id });
      logToFile(`Zgłoszenie ${id} zostało zaktualizowane`);
    },
  );
});

app.put("/api/feedback/:id", (req, res) => {
  const id = req.params.id;
  const { content } = req.body;

  db.run(
    `UPDATE feedback SET content = ? WHERE id = ?`,
    [content, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: "Nie znaleziono takiej opinii" });
      }
      res.json({ message: "Opinia została zaktualizowana", id: id });
      logToFile(`Opinia ${id} została zaktualizowania`);
    },
  );
});

//DELETE

app.delete("/api/messages/:id", (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM messages WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res
        .status(404)
        .json({ error: "Nie znaleziono takiej wiadomości" });
    }
    res.json({ message: "Wiadomość usunięta", id });
    io.emit("message_deleted", id);
  });
});

app.delete("/api/feedback/:id", (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM feedback WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ error: "Nie znaleziono takiej opinii" });
    }
    res.json({ message: "Opinia usunięta" });
  });
});

app.delete("/api/reports/:id", (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM reports WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res
        .status(404)
        .json({ error: "Nie znaleziono takiego zgłoszenia" });
    }
    res.json({ message: "Zgłoszenie usunięte" });
  });
});

app.delete("/api/users/:id", (req, res) => {
  const id = req.params.id;
  db.run(`DELETE FROM users WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res
        .status(404)
        .json({ error: "Nie znaleziono takiego użytkownika" });
    }
    res.json({ message: "Użytkownik usunięty" });
  });
});

app.post("/api/logout", (req, res) => {
  res.json({ message: "Wylogowano pomyślnie" });
});

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
  console.log("Połączono z brokerem MQTT");
  logToFile("Połączono z brokerem MQTT");

  mqttClient.subscribe("moj_projekt/status");
  mqttClient.subscribe("moj_projekt/alerts");

  setInterval(() => {
    const time = new Date().toLocaleTimeString();
    const statusMsg = `System OK: ${time}`;
    mqttClient.publish("moj_projekt/status", statusMsg);
    console.log("MQTT: Wysłano status do brokera");
  }, 15 * 1000);
});

mqttClient.on("message", (topic, message) => {
  //mqtt wysyła dane w formie bajtów
  const msgContent = message.toString();
  console.log(`Otrzymano wiadomość MQTT na temat ${topic}: ${msgContent}`);

  // wysyłka przez websocket, frontend nie musi się łączyć z mqtt
  io.emit("mqtt_message", {
    topic: topic,
    content: msgContent,
    time: new Date().toLocaleTimeString(),
  });
});

// uruchomienie serwera
server.listen(PORT, () => {
  const msg = `Serwer działa na http://localhost:${PORT}`;
  console.log(msg);
  logToFile(msg);
});
