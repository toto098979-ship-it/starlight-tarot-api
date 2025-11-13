// pages/api/tarot.js

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

    if (!question || !Array.isArray(cards) || !Array.isArray(positions)) {
      return res.status(400).json({
        error: "question, cards[], positions[] 가 모두 필요합니다."
      });
    }

    const pairedList = cards.map((name, i) => ({
      name,
      position: positions[i] || ""
    }));

    const systemPrompt = `
당신은 한국인 전문 타로 리더입니다.

사용자의 질문과 카드 정보를 기반으로 아래 JSON만 출력하세요:

{
  "cards": [
    {
      "name": "카드명",
      "position": "포지션",
      "keywords": ["키워드1", "키워드2"],
      "summary": "한두 문장 요약",
      "reading": "자세한 해석"
    }
  ],
  "overall": {
    "summary": "전체 요약",
    "advice": "조언"
  }
}
`;

    const userPrompt = `
[질문]
${question}

[뽑힌 카드 목록]
${pairedList
  .map((c, idx) => `${idx + 1}. ${c.name} (${c.position})`)
  .join("\n")}

위 내용을 기반으로 JSON만 출력하세요.
`;

    // 🔥 핵심: output_text로 처리 (가장 안정적)
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    // 🔥 가장 안정적인 JSON 결과 접근
    let raw = "";

    // 1) 직접 output_text가 존재하면 우선 사용
    if (response.output_text) {
      raw = response.output_text;
    }
    // 2) content[0].text 있는지 확인
    else if (
      response.output &&
      response.output[0] &&
      response.output[0].content &&
      response.output[0].content[0] &&
      response.output[0].content[0].text
    ) {
      raw = response.output[0].content[0].text;
    }
    else {
      throw new Error("OpenAI 응답에서 JSON 텍스트를 찾을 수 없습니다.");
    }

    const data = JSON.parse(raw);

    if (!data.cards || !data.overall) {
      return res.status(500).json({
        error: "AI JSON 구조가 올바르지 않습니다.",
        raw
      });
    }

    return res.status(200).json({
      cards: data.cards,
      overall: data.overall
    });

  } catch (error) {
    console.error("🔴 Tarot API Error:", error);

    return res.status(500).json({
      error: "서버 오류 발생",
      message: error.message || String(error)
    });
  }
}
