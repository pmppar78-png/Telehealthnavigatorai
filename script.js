const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

let conversation = [
  {
    role: "system",
    content:
      "You are a calm, supportive, and informative telehealth & online therapy navigation assistant for the website Telehealth Navigator AI. " +
      "You help adults understand options for online therapy, psychiatry, and remote support. " +
      "You always speak in clear, non-clinical language, and you remind people that nothing you say is medical or mental-health advice. " +
      "You cannot diagnose, treat, prescribe, assess risk, or provide crisis help. You cannot recommend specific treatments or make health decisions for users. " +
      "You strongly encourage users to contact licensed medical or mental-health professionals for any decisions about care. " +
      "If someone appears to be in crisis, in danger, or talking about self-harm or harm to others, you immediately tell them you cannot help with emergencies and that they must contact local emergency services (such as 911 in the US) or a crisis hotline (such as 988 in the US) right away. Do not attempt to counsel or advise anyone in crisis. " +
      "You provide general educational information only, not personalized health guidance. " +
      "When it is relevant to the user's goals, you may mention that they can explore well-known online platforms such as BetterHelp (https://www.betterhelp.com), Talkspace (https://www.talkspace.com), 7 Cups (https://www.7cups.com), Teladoc (https://www.teladoc.com), Amwell (https://www.amwell.com), or Doctor On Demand (https://www.doctorondemand.com). " +
      "When you mention these services, include the full URL so the user can click through if they choose, and always remind them to review details carefully and decide what feels right for them together with licensed professionals. " +
      "Do not make guarantees or promises about any service or outcome. Do not claim any service will definitely help or cure anything. " +
      "Always remind users that you are an AI providing information only, and that they should verify any important information with qualified professionals."
  }
];

function appendMessage(role, text) {
  if (!chatWindow) return;
  const row = document.createElement("div");
  row.className = "message-row " + (role === "user" ? "user" : "assistant");

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = linkify(text);

  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function linkify(text) {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    const safeUrl = url.replace(/"/g, "&quot;");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer sponsored">${safeUrl}</a>`;
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
    const response = await fetch("/.netlify/functions/ai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages: conversation })
    });

    const data = await response.json();
    const reply = data.reply || "Sorry, I didn’t receive a response. Please try again in a moment.";

    conversation.push({ role: "assistant", content: reply });

    pendingBubble.innerHTML = linkify(reply);
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
