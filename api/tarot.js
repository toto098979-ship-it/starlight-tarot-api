import OpenAI from "openai";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question, cards } = await req.json();
  if (!question || !cards) {
    return new Response(JSON.stringify({ error: "Missing question or cards" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "너는 부드럽고 현실적인 타로리더이다. 카드 의미를 연결해서 자연스럽게 상담하듯이 리딩해줘." },
        { role: "user", content: `질문: ${question}\n뽑힌 카드: ${JSON.stringify(cards)}` },
      ],
    });

    const result = completion.choices[0].message.content;

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate tarot reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
