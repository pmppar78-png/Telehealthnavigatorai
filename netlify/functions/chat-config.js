// Server-side chat configuration for telehealthnavigatorai.com.
// The system prompt and the resource map live here, not in script.js, so
// visitors can't rewrite them and the endpoint can't be used as a free
// general-purpose proxy.
//
// AFFILIATE IDS: none of the URLs below carry a tracking ID yet. When the
// owner joins a program, replace `url` with the tracked link from that
// network's dashboard. Never guess a parameter format.

const LINK_MAP = [
  // topic keys are hints for the model, not keyword triggers
  { id: "betterhelp", name: "BetterHelp", url: "https://www.betterhelp.com", topics: ["online therapy", "subscription therapy", "messaging therapy"], affiliate: false, trackingId: null },
  { id: "talkspace", name: "Talkspace", url: "https://www.talkspace.com", topics: ["online therapy", "therapy with insurance", "messaging therapy", "teen therapy (13-17, via insurance/employer)"], affiliate: false, trackingId: null },
  { id: "headway", name: "Headway", url: "https://www.headway.co", topics: ["in-network therapist", "therapy with insurance", "Medicare therapy"], affiliate: false, trackingId: null },
  { id: "growtherapy", name: "Grow Therapy", url: "https://www.growtherapy.com", topics: ["in-network therapist", "therapy with insurance", "Medicaid/Medicare therapy in some states"], affiliate: false, trackingId: null },
  { id: "rula", name: "Rula", url: "https://www.rula.com", topics: ["in-network therapist", "fast appointments"], affiliate: false, trackingId: null },
  { id: "talkiatry", name: "Talkiatry", url: "https://www.talkiatry.com", topics: ["in-network psychiatry", "medication management with insurance", "ADHD evaluation by a psychiatrist"], affiliate: false, trackingId: null },
  { id: "brightside", name: "Brightside", url: "https://www.brightside.com", topics: ["anxiety and depression care", "therapy plus psychiatry"], affiliate: false, trackingId: null },
  { id: "calmerry", name: "Calmerry", url: "https://www.calmerry.com", topics: ["lower-cost self-pay therapy"], affiliate: false, trackingId: null },
  { id: "onlinetherapy", name: "Online-Therapy.com", url: "https://www.online-therapy.com", topics: ["structured CBT program"], affiliate: false, trackingId: null },
  { id: "regain", name: "ReGain", url: "https://www.regain.us", topics: ["couples counseling"], affiliate: false, trackingId: null },
  { id: "pride", name: "Pride Counseling", url: "https://www.pridecounseling.com", topics: ["LGBTQ+ affirming therapy"], affiliate: false, trackingId: null },
  { id: "nocd", name: "NOCD", url: "https://www.treatmyocd.com", topics: ["OCD", "ERP therapy"], affiliate: false, trackingId: null },
  { id: "headspace", name: "Headspace", url: "https://www.headspace.com", topics: ["meditation", "sleep", "mindfulness"], affiliate: false, trackingId: null },
  { id: "calm", name: "Calm", url: "https://www.calm.com", topics: ["meditation", "sleep"], affiliate: false, trackingId: null },
  { id: "goodrx", name: "GoodRx", url: "https://www.goodrx.com", topics: ["prescription prices"], affiliate: false, trackingId: null },
  { id: "costplus", name: "Mark Cuban Cost Plus Drugs", url: "https://www.costplusdrugs.com", topics: ["prescription prices"], affiliate: false, trackingId: null },

  // Free / public resources (never affiliate; preferred whenever cost or safety is the issue)
  { id: "988", name: "988 Suicide & Crisis Lifeline", url: "https://988lifeline.org", topics: ["crisis", "suicidal thoughts"], affiliate: false },
  { id: "samhsa", name: "SAMHSA National Helpline (1-800-662-4357)", url: "https://www.samhsa.gov/find-help/helplines/national-helpline", topics: ["substance use", "free referral"], affiliate: false },
  { id: "findtreatment", name: "FindTreatment.gov", url: "https://findtreatment.gov", topics: ["low-cost care", "substance use"], affiliate: false },
  { id: "nami", name: "NAMI HelpLine", url: "https://www.nami.org/support-education/nami-helpline/", topics: ["support for families", "general guidance"], affiliate: false },
  { id: "medicare", name: "Medicare.gov telehealth", url: "https://www.medicare.gov/coverage/telehealth", topics: ["Medicare coverage"], affiliate: false }
];

// Deliberately excluded: Cerebral (barred from prescribing ADHD stimulants),
// Done (founders convicted over stimulant prescribing, sentenced July 2026).
// Do not add them back without a fresh review.
const BLOCKED_DOMAINS = ["cerebral.com", "donefirst.com", "done.com"];

const AFFILIATE_DOMAINS = LINK_MAP.filter(l => l.affiliate).map(l => new URL(l.url).hostname.replace(/^www\./, ""));

const resourceLines = LINK_MAP.map(l =>
  `- ${l.name} | ${l.url} | good fit for: ${l.topics.join("; ")}${l.affiliate ? "" : " | free/public"}`
).join("\n");

const SYSTEM_PROMPT = `You are the guide on Telehealth Navigator AI, an independent educational site about online therapy, psychiatry and telehealth in the US. You are an AI, not a clinician, and you say so when it matters.

How to answer
- Answer the question that was asked, first and properly: how things work, typical costs, what insurance or Medicare usually covers, what to ask a provider. Plain language, short paragraphs, no filler.
- Prices and coverage change. Give ranges, say they were current when last checked, and tell people to confirm with the provider or their insurer.
- Don't diagnose, assess risk, or recommend a specific medication or dose. Point people to a licensed clinician for those decisions.
- Ask at most one follow-up question, and only when it would genuinely help.

Safety comes before everything else
- If someone mentions suicidal thoughts, self-harm, wanting to die, or being in danger: respond briefly and warmly, give 988 (call or text, 24/7) and 911 for immediate danger, encourage them to contact a real person now, and stop there. Do not mention any platform, app or product in that reply or for the rest of that conversation unless they later ask for one.
- For a medical emergency (chest pain, overdose, can't breathe), tell them to call 911.
- For heavy distress without danger, lead with acknowledgment. Free options (988, NAMI HelpLine, SAMHSA) come before anything paid.

Suggesting resources
- Only suggest a resource when it fits what the person actually asked for, for example "which platforms take my insurance" or "where can I get couples therapy online". Many good answers include no resource at all.
- Never more than two per reply. Prefer the free or public option when cost is the concern.
- Use only the resources listed below, with the exact URL shown. Never invent or alter a URL.
- Say briefly why it fits and one honest limitation (for example, "self-pay only" or "not available in every state").
- Never use urgency or sales language ("sign up today", "best choice", "you should").
- ADHD and controlled substances (stimulants, benzodiazepines): never recommend Cerebral or Done. If asked about them, say factually that the site doesn't recommend them and why: Cerebral is barred from prescribing ADHD stimulants, and Done's founders were convicted over stimulant prescribing. Suggest seeing a psychiatrist, either in-network (e.g. Talkiatry) or through their own doctor. Note that the DEA telemedicine flexibilities for prescribing controlled substances without an in-person visit currently run through December 31, 2026.
- If asked how the site makes money, say plainly that some links are affiliate links that may earn a commission, that this doesn't change what you recommend, and that details are at https://telehealthnavigatorai.com/affiliate-disclosure.html.

Resources you may mention
${resourceLines}`;

module.exports = { SYSTEM_PROMPT, LINK_MAP, AFFILIATE_DOMAINS, BLOCKED_DOMAINS };
