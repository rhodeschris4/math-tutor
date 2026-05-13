const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const sendBtn = chatForm.querySelector(".chat__send-btn");
const pillButtons = document.querySelectorAll(".chat__pill");
const sessionList = document.getElementById("session-list");
const newSessionBtn = document.querySelector(".sidebar__new-session");

let history = [];
let sessionId = crypto.randomUUID();
let sessionTitle = "";

function renderKaTeX(element) {
  renderMathInElement(element, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  });
}

function addMessage(role, content) {
  const bubble = document.createElement("div");
  bubble.className = `chat__bubble chat__bubble--${role}`;
  const textSpan = document.createElement("span");
  textSpan.className = "message-text";
  textSpan.textContent = content;
  bubble.appendChild(textSpan);
  messagesContainer.appendChild(bubble);
  renderKaTeX(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return bubble;
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  pillButtons.forEach((btn) => (btn.disabled = loading));
}

async function saveSession() {
  if (!history.length) return;
  await fetch(`/sessions/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: sessionTitle, messages: history }),
  });
  loadSessionList();
}

async function sendMessage(text) {
  history.push({ role: "user", content: text });
  if (!sessionTitle) sessionTitle = text.slice(0, 40);
  addMessage("user", text);
  chatInput.value = "";
  setLoading(true);

  const messageEl = addMessage("assistant", "");
  const textEl = messageEl.querySelector(".message-text");
  let fullText = "";
  let buffer = "";

  try {
    const resp = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        const { text } = JSON.parse(payload);
        fullText += text;
        textEl.textContent = fullText;
      }
    }

    renderMathInElement(messageEl, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });

    history.push({ role: "assistant", content: fullText });
    saveSession();
  } catch (err) {
    textEl.textContent = "Something went wrong. Is the server running?";
  }
  setLoading(false);
  chatInput.focus();
}

function startNewSession() {
  sessionId = crypto.randomUUID();
  sessionTitle = "";
  history = [];
  messagesContainer.innerHTML = "";
  chatInput.focus();
  renderSessionList([]);
  loadSessionList();
}

function renderSessionList(sessions) {
  const label = sessionList.querySelector(".sidebar__sessions-label");
  sessionList.innerHTML = "";
  sessionList.appendChild(label);

  for (const s of sessions) {
    const item = document.createElement("div");
    item.className = "sidebar__session-item";
    if (s.id === sessionId) item.classList.add("sidebar__session-item--active");
    item.innerHTML = `
      <span class="sidebar__session-title">${s.title}</span>
      <span class="sidebar__session-date">${formatDate(s.updated_at)}</span>
    `;
    item.addEventListener("click", () => loadSession(s.id));
    sessionList.appendChild(item);
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

async function loadSessionList() {
  const resp = await fetch("/sessions");
  const sessions = await resp.json();
  renderSessionList(sessions);
}

async function loadSession(id) {
  const resp = await fetch(`/sessions/${id}`);
  const data = await resp.json();
  sessionId = data.id;
  sessionTitle = data.title;
  history = data.messages;
  messagesContainer.innerHTML = "";
  for (const msg of history) addMessage(msg.role, msg.content);
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  sendMessage(text);
});

pillButtons.forEach((btn) => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.message));
});

newSessionBtn.addEventListener("click", startNewSession);

document.addEventListener("DOMContentLoaded", () => {
  const problem = document.getElementById("current-problem");
  if (problem) renderKaTeX(problem);
  loadSessionList();
});
