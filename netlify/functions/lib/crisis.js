// Deterministic crisis screen: runs before any model call. If any user message
// in the window sent to the model (the last 20 turns) matches, the function
// returns fixed crisis resources and never calls the model or shows any
// product or link. Assistant replies are not screened.
const CRISIS_PATTERNS = [
  /\b(kill|killing|hurt|hurting|harm|harming)\s+(my ?self|myself)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanna|going|plan|planning)\s+to\s+die\b/i,
  /\b(end|ending)\s+(my|it)\s+(life|all)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bself[-\s]?harm\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\boverdos(e|ed|ing)\b/i,
  /\b(kill|hurt)\s+(him|her|them|someone|somebody|people)\b/i,
  /\bcan'?t\s+go\s+on\b/i
];
const CRISIS_REPLY =
  "I'm really sorry you're going through this, and I'm glad you said something. I'm an AI and can't give the help you deserve right now, but people can, right away:\n\n" +
  "- Call or text 988 (Suicide & Crisis Lifeline, U.S., 24/7), or chat at 988lifeline.org\n" +
  "- Text HOME to 741741 (Crisis Text Line)\n" +
  "- If you or someone else is in immediate danger, call 911 or go to the nearest emergency room\n\n" +
  "If you can, reach out to someone you trust and let them know how you're feeling. You don't have to go through this alone.";
function isCrisis(text) {
  return typeof text === "string" && CRISIS_PATTERNS.some((re) => re.test(text));
}
module.exports = { isCrisis, CRISIS_REPLY };
