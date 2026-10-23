const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

// Personalization panel elements
const personalizationPanel = document.getElementById("personalizationPanel");
const personalizationToggle = document.getElementById("personalizationToggle");
const personalizationContent = document.getElementById("personalizationContent");
const personalizationForm = document.getElementById("personalizationForm");
const skipPersonalization = document.getElementById("skipPersonalization");

let userContext = null; // Stores personalization answers

// The system prompt now lives server-side in netlify/functions/chat-config.js.
// Only user and assistant turns are kept here.
let conversation = [];

const DISCLOSURE_HTML =
  '<p class="chat-disclosure" style="font-size:.8rem;color:#666;margin-top:.5rem;border-top:1px solid #eee;padding-top:.4rem">Some links in this answer may be paid links. ' +
  '<a href="/affiliate-disclosure">How this works</a></p>';

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendMessage(role, text) {
  if (!chatWindow) return;
  const row = document.createElement("div");
  row.className = "message-row " + (role === "user" ? "user" : "assistant");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = linkify(escapeHtml(text));
  }

  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function linkify(text) {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s<&]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="nofollow noopener noreferrer">${url}</a>`;
  });
}

async function sendMessage(message) {
  appendMessage("user", message);
  conversation.push({ role: "user", content: message });

  const pendingRow = document.createElement("div");
  pendingRow.className = "message-row assistant";
  const pendingBubble = document.createElement("div");
  pendingBubble.className = "message-bubble";
  pendingBubble.textContent = "Thinking…";
  pendingRow.appendChild(pendingBubble);
  chatWindow.appendChild(pendingRow);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const response = await fetch("/api/ai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: conversation, context: userContext || "" })
    });

    const data = await response.json();
    const reply = data.reply || "Sorry, I didn’t receive a response. Please try again in a moment.";

    conversation.push({ role: "assistant", content: reply });

    pendingBubble.innerHTML = linkify(escapeHtml(reply)) + (data.hasAffiliate ? DISCLOSURE_HTML : "");
  } catch (err) {
    pendingBubble.textContent =
      "I ran into a technical issue reaching the AI service. Please try again in a moment.";
    console.error(err);
  } finally {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

if (chatForm && userInput) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = "";
    sendMessage(text);
  });

  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });
}

// Personalization panel functionality
if (personalizationToggle && personalizationContent) {
  personalizationToggle.addEventListener("click", () => {
    const isExpanded = personalizationToggle.getAttribute("aria-expanded") === "true";
    personalizationToggle.setAttribute("aria-expanded", !isExpanded);
    personalizationContent.style.display = isExpanded ? "none" : "block";
  });
}

if (skipPersonalization) {
  skipPersonalization.addEventListener("click", () => {
    collapsePersonalization();
  });
}

if (personalizationForm) {
  personalizationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyPersonalization();
  });
}

function collapsePersonalization() {
  if (personalizationPanel) {
    personalizationPanel.classList.add("collapsed");
    personalizationToggle.setAttribute("aria-expanded", "false");
    personalizationContent.style.display = "none";
    personalizationToggle.innerHTML = `
      <span class="toggle-icon">✓</span>
      <span class="toggle-text">Ready to chat</span>
    `;
    personalizationToggle.style.pointerEvents = "none";
  }
}

function applyPersonalization() {
  const pq1 = document.getElementById("pq1")?.value;
  const pq2 = document.getElementById("pq2")?.value;
  const pq3 = document.getElementById("pq3")?.value;

  // Build context string from answers
  const contextParts = [];

  if (pq1) {
    const reasonMap = {
      "exploring": "is exploring available telehealth options",
      "stress": "is dealing with stress or life challenges",
      "mood": "has concerns about mood or emotions",
      "specific": "is looking for help with something specific",
      "someone": "is helping someone else find resources"
    };
    if (reasonMap[pq1]) contextParts.push(reasonMap[pq1]);
  }

  if (pq2) {
    const typeMap = {
      "therapy": "is interested in therapy or counseling",
      "psychiatry": "has questions about psychiatry or medication",
      "both": "is interested in both therapy and psychiatry",
      "wellness": "is interested in general wellness and self-care",
      "unsure": "is not yet sure what type of support they need"
    };
    if (typeMap[pq2]) contextParts.push(typeMap[pq2]);
  }

  if (pq3) {
    const insuranceMap = {
      "private": "has private insurance",
      "medicare": "has Medicare",
      "medicaid": "has Medicaid",
      "selfpay": "is looking at self-pay options",
      "unsure": "is unsure about their insurance situation"
    };
    if (insuranceMap[pq3]) contextParts.push(insuranceMap[pq3]);
  }

  if (contextParts.length > 0) {
    userContext = contextParts.join(", ");
    // Sent with each request as `context`; the server appends it to its own prompt.
  }

  collapsePersonalization();

  // Focus the chat input
  if (userInput) {
    userInput.focus();
  }
}
