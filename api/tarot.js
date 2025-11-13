// pages/api/tarot.js  (Vercel Serverless)

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 지원합니다." });
  }

  try {
    const { question, cards, positions } = req.body;

    // 기본 안전검사
    if (!question || !Array.isArray(cards) || !Array.isArray(positions)) {
      return res.status(400).json({
        error: "question, cards[], positions[] 가 모두 필요합니다."
      });
    }

    // 카드 + 포지션 매칭
    const pairedList = cards.map((name, i) => ({
      name,
      position: positions[i] || ""
    }));

    // 시스템 프롬프트
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

    // 유저 프롬프트
    const userPrompt = `
[질문]
${question}

[뽑힌 카드 목록]
${pairedList
  .map((c, idx) => `${idx + 1}. ${c.name} (${c.position})`)
  .join("\n")}

위 데이터 기반으로 위에서 정의한 JSON만 출력하세요.
`;

    // ✅ responses 말고, 안정적인 chat.completions + JSON 모드 사용
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    // OpenAI가 넘긴 JSON 문자열
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("OpenAI 응답에서 content를 찾지 못했습니다.");
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("JSON 파싱 실패 raw:", raw);
      throw new Error("AI 응답 JSON 파싱 실패");
    }

    if (!data.cards || !data.overall) {
      return res.status(500).json({
        error: "AI JSON 구조가 올바르지 않습니다.",
        raw: data
      });
    }

    // 프론트에서 쓰는 A2 구조 그대로 리턴
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
