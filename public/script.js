const socket = io();
let currentUser = null;

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) return alert("Podaj nick i hasło!");

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
        const data = await res.json();
        alert(
          data.error || "Błąd logowania. Sprawdź dane lub zarejestruj się.",
        );
      }
    })
    .catch((err) => console.error("Błąd sieci:", err));
}

function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password)
    return alert("Podaj nick i hasło do rejestracji!");

  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (res.ok) {
        alert("Zarejestrowano pomyślnie! Zostaniesz zalogowany.");
        enterChat(username);
      } else {
        const data = await res.json();
        alert(data.error || "Błąd rejestracji");
      }
    })
    .catch((err) => console.error("Błąd sieci:", err));
}

function logout() {
  fetch("/api/logout", { method: "POST" }).then(() => {
    currentUser = null;
    document.getElementById("chat-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  });
}

function enterChat(username) {
  currentUser = username;
  document.getElementById("user-display").innerText = username;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("chat-screen").style.display = "block";
  loadMessages();
}

function loadMessages() {
  fetch("/api/messages")
    .then((res) => res.json())
    .then((data) => renderMessages(data));
}

function searchMessages() {
  const query = document.getElementById("search-input").value;
  fetch(`/api/messages?search=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((data) => renderMessages(data));
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

function deleteMessage(id) {
  if (!confirm("Czy na pewno chcesz usunąć tę wiadomość?")) return;

  fetch(`/api/messages/${id}`, {
    method: "DELETE",
  }).then((res) => {
    if (!res.ok) alert("Błąd usuwania");
  });
}

function editMessage(id) {
  const newContent = prompt("Edytuj treść wiadomości:");
  if (newContent === null || newContent.trim() === "") return;

  fetch(`/api/messages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: newContent }),
  }).then((res) => {
    if (!res.ok) alert("Błąd edycji");
  });
}

function sendFeedback() {
  const input = document.getElementById("feedback-input");
  const content = input.value;
  if (!content) return alert("Wpisz opinię!");

  fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);
      input.value = "";
    });
}

function reportUser(reportedUser) {
  const reason = prompt(`Dlaczego chcesz zgłosić użytkownika ${reportedUser}?`);
  if (!reason) return;

  fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportedUser, reason }),
  })
    .then((res) => res.json())
    .then((data) => alert(data.message))
    .catch(() => alert("Błąd zgłoszenia"));
}

function renderMessages(data) {
  const div = document.getElementById("messages");
  div.innerHTML = "";
  data.forEach((msg) => appendMessage(msg));
}

function appendMessage(msg) {
  const div = document.getElementById("messages");
  const el = document.createElement("div");
  const isMine = msg.sender === currentUser;

  el.className = `msg ${isMine ? "mine" : "others"}`;

  let actionButtons = "";

  if (isMine) {
    actionButtons = `
      <div class="msg-actions">
        <button onclick="editMessage(${msg.id})" class="btn-sm btn-edit">✎</button>
        <button onclick="deleteMessage(${msg.id})" class="btn-sm btn-delete">✕</button>
      </div>
    `;
  } else {
    actionButtons = `
      <div class="msg-actions">
        <button onclick="reportUser('${msg.sender}')" class="btn-sm btn-report" title="Zgłoś użytkownika">!</button>
      </div>
    `;
  }

  el.innerHTML = `
    <div class="msg-header"><strong>${msg.sender}</strong></div>
    <div class="msg-content">${msg.content}</div>
    ${actionButtons}
  `;

  div.appendChild(el);
  div.scrollTop = div.scrollHeight;
}

socket.on("chat_message", (msg) => {
  appendMessage(msg);
});

socket.on("message_updated", (data) => {
  loadMessages();
});

socket.on("message_deleted", (id) => {
  loadMessages();
});

socket.on("connect", () => {
  document.getElementById("status-mqtt").innerText =
    "Status: Połączono z serwerem";
});

function loadReports() {
  fetch("/api/reports")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("admin-content");
      container.innerHTML =
        "<h4>Zgłoszenia:</h4>" +
        data
          .map(
            (r) =>
              `<div>Użytkownik: ${r.reported_user}, Powód: ${r.reason}</div>`,
          )
          .join("");
    });
}

function loadFeedback() {
  fetch("/api/feedback")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("admin-content");
      container.innerHTML =
        "<h4>Opinie:</h4>" +
        data.map((f) => `<div>Treść: ${f.content} (${f.date})</div>`).join("");
    });
}
