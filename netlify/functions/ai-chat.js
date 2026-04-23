const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body." })
    };
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];

  const postData = JSON.stringify({
    model: "gpt-4.1-mini",
    messages,
    temperature: 0.9,
    max_tokens: 2048
  });

  const options = {
    hostname: "api.openai.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(postData)
    }
  };

  const apiResponse = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    });

    req.on("error", (error) => reject(error));
    req.write(postData);
    req.end();
  }).catch((error) => {
    console.error("ai-chat upstream request failed:", error && error.message);
    return { status: 502, data: JSON.stringify({ error: "Upstream AI service unavailable. Please try again in a moment." }) };
  });

  if (apiResponse.status < 200 || apiResponse.status >= 300) {
    console.error("ai-chat upstream non-2xx:", apiResponse.status);
    return {
      statusCode: apiResponse.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "The AI service returned an error. Please try again in a moment." })
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(apiResponse.data);
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to parse response from OpenAI." })
    };
  }

  const reply =
    parsed &&
    parsed.choices &&
    parsed.choices[0] &&
    parsed.choices[0].message &&
    parsed.choices[0].message.content
      ? parsed.choices[0].message.content
      : "I’m not sure how to respond to that right now, but you can try asking again or in a different way.";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply })
  };
};
