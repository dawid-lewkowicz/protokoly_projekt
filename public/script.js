const socket = io();
let currentUser = null;
let currentUserId = null;

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) return alert("Podaj nick i hasło!");

  fetch("/api/login", {
    method: "POST",
    // headers to informacja o wysyłaniu danych w formacie JSON
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        enterChat(data.username, data.id);
      } else if (res.status === 401) {
        alert("Błędne hasło!");
      } else {
        const data = await res.json();
        alert(data.error || "Błąd logowania.");
      }
    })
    .catch((err) => console.log(`Błąd sieci: ${err}`));
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
        const data = await res.json();
        enterChat(data.username, data.id);
      } else {
        const data = await res.json();
        alert(data.error || "Błąd rejestracji");
      }
    })
    .catch((err) => console.error(`Błąd sieci: ${err}`));
}

function logout() {
  fetch("/api/logout", { method: "POST" }).then(() => {
    currentUser = null;
    currentUserId = null;
    document.getElementById("chat-screen").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  });
}

function enterChat(username, id) {
  currentUser = username;
  currentUserId = id;
  document.getElementById("user-display").innerText = username;
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("chat-screen").classList.remove("hidden");

  loadMessages();
  loadReports();
  loadFeedback();
}

function deleteAccount() {
  if (!currentUserId) return;
  if (!confirm("Czy na pewno chcesz usunąć konto?")) return;

  fetch(`/api/users/${currentUserId}`, { method: "DELETE" }).then((res) => {
    if (res.ok) {
      alert("Konto usunięte.");
      location.reload();
    } else {
      alert("Błąd usuwania konta.");
    }
  });
}

function changePassword() {
  if (!currentUserId) return;
  const newPassword = prompt("Podaj nowe hasło:");
  if (!newPassword) return;

  fetch(`/api/users/${currentUserId}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // JSON.stringify() zmienia obiekt na jeden długi string
    body: JSON.stringify({ newPassword }),
  }).then(async (res) => {
    if (res.ok) alert("Hasło zmienione.");
    else alert("Błąd zmiany hasła.");
  });
}

function loadMessages() {
  fetch("/api/messages")
    .then((res) => res.json())
    .then((data) => renderMessages(data));
}

function searchMessages() {
  const query = document.getElementById("search-input").value;
  // encodeURIComponent zabezpiecza przed problemami z np. spacją w query
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
  if (!confirm("Usunąć wiadomość?")) return;
  fetch(`/api/messages/${id}`, { method: "DELETE" });
}

function editMessage(id) {
  const newContent = prompt("Edytuj wiadomość:");
  if (!newContent) return;
  fetch(`/api/messages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: newContent }),
  });
}

function renderMessages(data) {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  data.forEach((msg) => appendMessage(msg));
}

function appendMessage(msg) {
  const container = document.getElementById("messages");
  const isMine = msg.sender === currentUser;

  const wrapper = document.createElement("div");
  wrapper.className = `msg-wrapper ${isMine ? "mine" : "others"}`;

  let actionButtons = "";
  if (isMine) {
    actionButtons = `
      <div class="msg-actions">
        <button onclick="editMessage(${msg.id})" class="btn btn-sm btn-outline">✎</button>
        <button onclick="deleteMessage(${msg.id})" class="btn btn-sm btn-danger">✕</button>
      </div>`;
  } else {
    actionButtons = `
      <div class="msg-actions">
        <button onclick="reportUser('${msg.sender}')" class="btn btn-sm btn-outline">!</button>
      </div>`;
  }

  wrapper.innerHTML = `
    <div class="msg-header">${msg.sender}</div>
    <div class="msg-bubble">${msg.content}</div>
    ${actionButtons}
  `;

  container.appendChild(wrapper);
  // automatyczne przewijanie na sam dół
  container.scrollTop = container.scrollHeight;
}

function sendFeedback() {
  const input = document.getElementById("feedback-input");
  const content = input.value;
  if (!content) return;

  fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);
      input.value = "";
      loadFeedback();
    });
}

function reportUser(reportedUser) {
  const reason = prompt(`Powód zgłoszenia użytkownika ${reportedUser}:`);
  if (!reason) return;

  fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportedUser, reason }),
  }).then((res) => {
    if (res.ok) alert("Zgłoszono użytkownika.");
    else alert("Błąd podczas zgłaszania.");
    loadReports();
  });
}

function loadReports() {
  fetch("/api/reports")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("admin-content");
      if (data.length === 0) {
        container.innerHTML = "<p class='placeholder-text'>Brak zgłoszeń.</p>";
        return;
      }
      let html = "<ul>";
      data.forEach((r) => {
        html += `
          <li class="admin-item">
            <div>
                <strong>${r.reported_user}</strong><br>
                <small>${r.reason}</small>
            </div>
            <div class="admin-actions">
                <button onclick="editReport(${r.id})" class="btn btn-sm btn-outline">Edytuj</button>
                <button onclick="deleteReport(${r.id})" class="btn btn-sm btn-danger">Usuń</button>
            </div>
          </li>`;
      });
      html += "</ul>";
      container.innerHTML = html;
    });
}

function loadFeedback() {
  fetch("/api/feedback")
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById("admin-content");
      const currentHtml = container.innerHTML.includes("Brak zgłoszeń") // zwraca True lub Flase
        ? ""
        : container.innerHTML;

      let html = "<hr class='admin-divider'><h5>Opinie:</h5><ul>";
      if (data.length === 0)
        html += "<p class='placeholder-text'>Brak opinii.</p>";

      data.forEach((f) => {
        html += `
            <li class="admin-item">
                <div>
                    <small>${f.date}</small><br>
                    ${f.content}
                </div>
                <div class="admin-actions">
                    <button onclick="editFeedback(${f.id})" class="btn btn-sm btn-outline">Edytuj</button>
                    <button onclick="deleteFeedback(${f.id})" class="btn btn-sm btn-danger">Usuń</button>
                </div>
            </li>`;
      });
      html += "</ul>";
      container.innerHTML = currentHtml + html;
    });
}

function editReport(id) {
  const newReason = prompt("Nowy powód zgłoszenia:");
  if (!newReason) return;
  fetch(`/api/reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: newReason }),
  }).then(() => {
    loadReports();
  });
}

function deleteReport(id) {
  if (!confirm("Usunąć zgłoszenie?")) return;
  fetch(`/api/reports/${id}`, { method: "DELETE" }).then(() => {
    loadReports();
  });
}

function editFeedback(id) {
  const newContent = prompt("Edytuj treść:");
  if (!newContent) return;
  fetch(`/api/feedback/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: newContent }),
  }).then(() => {
    loadFeedback();
  });
}

function deleteFeedback(id) {
  if (!confirm("Usunąć opinię?")) return;
  fetch(`/api/feedback/${id}`, { method: "DELETE" }).then(() => {
    loadFeedback();
  });
}

// nasłuchiwanie sygnałów od serwera
socket.on("chat_message", (msg) => appendMessage(msg));
socket.on("message_updated", () => loadMessages());
socket.on("message_deleted", () => loadMessages());

socket.on("mqtt_message", (data) => {
  const statusElement = document.getElementById("status-mqtt");
  statusElement.innerHTML = `MQTT [${data.time}]: ${data.topic} -> ${data.content}`;
});

socket.on("connect", () => {
  document.getElementById("status-mqtt").innerText =
    "MQTT Status: Połączono z serwerem";
});
