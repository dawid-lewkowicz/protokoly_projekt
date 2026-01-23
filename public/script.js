const socket = io();
let currentUser = null;

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    return alert("Podaj nick i hasło!");
  }

  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (res.ok) {
        enterChat(username);
      } else if (res.status === 401) {
        alert("Błędne hasło!");
      } else {
        // jeśli bie ma usera, rejestrujemy go
        return fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }).then((regRes) => {
          if (regRes.ok) enterChat(username);
          else alert("Błąd rejestracji");
        });
      }
    })
    .catch((err) => console.error("Błąd sieci:", err));
}

function enterChat(username) {
  currentUser = username;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("chat-screen").style.display = "block";
  loadMessages();
}

function loadMessages() {
  fetch("/api/messages")
    .then((res) => res.json())
    .then((data) => {
      const div = document.getElementById("messages");
      div.innerHTML = "";
      data.forEach((msg) => appendMessage(msg));
    });
}

function sendMessage() {
  const input = document.getElementById("message-input");
  const content = input.value;
  if (!content) return;

  fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, sender: currentUser }),
  }).then(() => (input.value = ""));
}

socket.on("chat_message", (msg) => {
  appendMessage(msg);
});

// pomocnicza funkcja do wyświetlania
function appendMessage(msg) {
  const div = document.getElementById("messages");
  const el = document.createElement("div");
  el.className = `msg ${msg.sender === currentUser ? "mine" : "others"}`;
  el.innerHTML = `<strong>${msg.sender}:</strong> ${msg.content}`;
  div.appendChild(el);
  div.scrollTop = div.scrollHeight;
}

socket.on("connect", () => {
  document.getElementById("status-mqtt").innerText =
    "Status: Połączono z serwerem";
});
