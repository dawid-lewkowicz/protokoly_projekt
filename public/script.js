const socket = io();
let currentUser = null;
let currentUserId = null;

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
        const data = await res.json();
        enterChat(data.username, data.id);
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
        alert("Zarejestrowano pomyślnie!");
        const data = await res.json();
        enterChat(data.username, data.id);
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
    currentUserId = null;
    document.getElementById("chat-screen").style.display = "none";
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  });
}

function enterChat(username, id) {
  currentUser = username;
  currentUserId = id;
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

function deleteAccount() {
  if (!currentUserId) return alert("Błąd: Nie rozpoznano ID użytkownika.");
  if (
    !confirm(
      "CZY NA PEWNO CHCESZ USUNĄĆ KONTO? Tej operacji nie da się cofnąć!",
    )
  )
    return;

  fetch(`/api/users/${currentUserId}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (res.ok) {
        alert("Konto zostało usunięte.");
        location.reload();
      } else {
        alert("Błąd podczas usuwania konta.");
      }
    })
    .catch((err) => console.error(err));
}

function editReport(id) {
  const newReason = prompt("Podaj nowy powód zgłoszenia:");
  if (newReason === null || newReason.trim() === "") return;

  fetch(`/api/reports/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: newReason }),
  }).then((res) => {
    if (res.ok) {
      alert("Zaktualizowano zgłoszenie");
      loadReports();
    } else {
      alert("Błąd edycji");
    }
  });
}

function editFeedback(id) {
  const newContent = prompt("Edytuj treść opinii:");
  if (newContent === null || newContent.trim() === "") return;

  fetch(`/api/feedback/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: newContent }),
  }).then((res) => {
    if (res.ok) {
      alert("Zaktualizowano opinię");
      loadFeedback();
    } else {
      alert("Błąd edycji");
    }
  });
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
      if (data.length === 0) {
        container.innerHTML = "<p>Brak zgłoszeń.</p>";
        return;
      }
      let html = "<h4>Lista zgłoszeń:</h4><ul>";
      data.forEach((r) => {
        html += `
          <li style="margin-bottom: 5px; border-bottom: 1px solid #eee; padding: 5px;">
            <strong>Kogo:</strong> ${r.reported_user} | 
            <strong>Powód:</strong> ${r.reason} 
            <button onclick="editReport(${r.id})" class="btn-sm btn-edit" style="margin-left: 10px;">Edytuj</button>
            <button onclick="deleteReport(${r.id})" class="btn-sm btn-delete" style="margin-left: 5px;">Usuń</button>
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
      if (data.length === 0) {
        container.innerHTML = "<p>Brak opinii.</p>";
        return;
      }
      let html = "<h4>Opinie użytkowników:</h4><ul>";
      data.forEach((f) => {
        html += `
          <li style="margin-bottom: 5px; border-bottom: 1px solid #eee; padding: 5px;">
            <em>${f.date}</em>: ${f.content}
            <button onclick="editFeedback(${f.id})" class="btn-sm btn-edit" style="margin-left: 10px;">Edytuj</button>
            <button onclick="deleteFeedback(${f.id})" class="btn-sm btn-delete" style="margin-left: 5px;">Usuń</button>
          </li>`;
      });
      html += "</ul>";
      container.innerHTML = html;
    });
}

function deleteReport(id) {
  if (!confirm("Czy na pewno usunąć to zgłoszenie?")) return;

  fetch(`/api/reports/${id}`, { method: "DELETE" }).then((res) => {
    if (res.ok) {
      alert("Usunięto zgłoszenie");
      loadReports();
    } else {
      alert("Błąd usuwania");
    }
  });
}

function deleteFeedback(id) {
  if (!confirm("Czy na pewno usunąć tę opinię?")) return;
  fetch(`/api/feedback/${id}`, { method: "DELETE" }).then((res) => {
    if (res.ok) {
      alert("Usunięto opinię");
      loadFeedback();
    } else {
      alert("Błąd usuwania");
    }
  });
}
