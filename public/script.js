const socket = io();
let currentUser = null;

function login() {
  const username = document.getElementById("username").value;
  if (!username) return alert("Podaj nick!");

  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "123" }),
  }).then(() => {
    currentUser = username;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("chat-screen").style.display = "block";
    loadMessages();
  });
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

function appendMessage(msg) {
  // pomocnicza funkcja do wyświetlania
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
