// pages/api/tarot.js (Vercel Serverless)

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }

  try {
    const { question, cards, positions } = req.body;

    // 안전검사
    if (!question || !Array.isArray(cards) || !Array.isArray(positions)) {
      return res.status(400).json({
        error: "question, cards[], positions[] 가 모두 필요합니다."
      });
    }

    // 카드와 포지션 매칭
    const pairedList = cards.map((name, i) => ({
      name,
      position: positions[i] || ""
    }));

    // ------------------------------
    // 🔥 AI에게 A2 JSON 구조로 명령
    // ------------------------------
    const systemPrompt = `
당신은 한국인 전문 타로 리더입니다.

사용자의 질문과 뽑힌 카드 정보를 기반으로 아래 JSON 형식으로만 답변하세요.
반드시 이 형태여야 하며, 다른 텍스트를 절대 추가하지 마세요.

{
  "cards": [
    {
      "name": "카드명",
      "position": "포지션명",
      "keywords": ["키워드1", "키워드2"],
      "summary": "한두 문장 요약",
      "reading": "자세한 해석"
    }
  ],
  "overall": {
    "summary": "전체 흐름 요약",
    "advice": "조언"
  }
}

규칙:
- "cards"는 배열이어야 합니다.
- 각 카드 객체는 name, position, keywords(문자열 배열), summary, reading 필드를 포함해야 합니다.
- "overall"은 summary, advice 필드를 반드시 포함해야 합니다.
- 설명은 자연스러운 한국어로 작성하십시오.
`;

    const userPrompt = `
[질문]
${question}

[뽑힌 카드 목록]
${pairedList
  .map((c, idx) => `${idx + 1}. ${c.name} (${c.position})`)
  .join("\n")}

위 데이터 기반으로 A2 JSON 형태 그대로 출력하세요.
`;

    // ------------------------------
    // 🔥 OpenAI 호출(JSON 반환)
    // ------------------------------
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });
    
console.log("🔍 AI RESPONSE RAW:", JSON.stringify(response, null, 2));
    
    const raw = response.output[0].content[0].text;
    const data = JSON.parse(raw);

    if (!data.cards || !data.overall) {
      return res.status(500).json({
        error: "AI JSON 구조가 올바르지 않습니다.",
        raw
      });
    }

    // 프론트에서 필요로 하는 그대로 반환
    return res.status(200).json({
      cards: data.cards,
      overall: data.overall
    });

  } catch (error) {
    console.error("Tarot API Error:", error);

    return res.status(500).json({
      error: "서버 오류 발생",
      message: error.message || String(error)
    });
  }
}
