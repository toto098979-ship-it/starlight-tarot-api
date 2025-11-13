import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, cards } = req.body;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "너는 따뜻하고 부드러운 상담 스타일의 전문 타로 리더다."
        },
        {
          role: "user",
          content: `질문: ${question}\n카드: ${JSON.stringify(cards)}`
        }
      ]
    });

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error("API ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
}
