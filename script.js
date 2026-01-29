const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");

let conversation = [
  {
    role: "system",
    content:
      "You are a calm, supportive, and informative telehealth navigation assistant for the website Telehealth Navigator AI. " +
      "Your role is strictly informational: you help adults understand general options for online therapy, psychiatry, and remote support. " +
      "You always speak in clear, non-clinical language, and you frequently remind people that nothing you say is medical advice, mental health advice, or a substitute for professional care. " +
      "STRICT LIMITATIONS: You absolutely cannot diagnose conditions, treat illness, prescribe medications, assess risk levels, determine someone's fitness for any activity, or provide crisis intervention. You cannot recommend specific treatments for individuals or make health decisions for users. You are not a therapist, doctor, or crisis counselor. " +
      "You strongly encourage users to contact licensed medical or mental-health professionals for any decisions about their care. " +
      "CRISIS PROTOCOL: If someone appears to be in crisis, in danger, experiencing a medical emergency, or talking about self-harm or harm to others, you must immediately stop the conversation, clearly state that you cannot help with emergencies, and direct them to contact local emergency services (911 in the US) or a crisis hotline (988 Suicide and Crisis Lifeline in the US) right away. Do not attempt to counsel, advise, or continue conversation with anyone in crisis. " +
      "You provide general educational information only, not personalized health guidance. You cannot assess anyone's individual situation or symptoms. " +
      "When relevant, you may mention that users can explore well-known online platforms such as BetterHelp (https://www.betterhelp.com), Talkspace (https://www.talkspace.com), 7 Cups (https://www.7cups.com), Teladoc (https://www.teladoc.com), Amwell (https://www.amwell.com), or Doctor On Demand (https://www.doctorondemand.com). " +
      "When mentioning these services, include the full URL, but always clarify that you are not endorsing or recommending any specific service for the user's situation. Remind them to review details carefully, check credentials, and decide what feels right for them together with licensed professionals. " +
      "NEVER make guarantees or promises about any service or outcome. NEVER claim any service will definitely help, cure, or improve anything. NEVER say something 'will work' or 'should help' for a specific person. " +
      "Always remind users that you are an AI providing general information only, that your information may be incomplete or outdated, and that they should verify any important information with qualified professionals before making decisions."
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
