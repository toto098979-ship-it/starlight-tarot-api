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

    // ------------------------------
    // 🔒 1차 유효성 검사
    // ------------------------------
    if (!question || !Array.isArray(cards) || !Array.isArray(positions)) {
      return res.status(400).json({
        error: "question, cards[], positions[] 가 모두 필요합니다."
      });
    }

    // ------------------------------
    // 카드 + 포지션 매칭 (길이 보정)
    // ------------------------------
    const fixedPositions = positions.slice(0, cards.length);
    while (fixedPositions.length < cards.length) {
      fixedPositions.push("");
    }

    const pairedList = cards.map((name, i) => ({
      name,
      position: fixedPositions[i] || ""
    }));

    // ------------------------------
    // 🔥 프롬프트
    // ------------------------------
    const systemPrompt = `
당신은 한국인 전문 타로 리더입니다.

아래 JSON 형식으로만 출력하세요:

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
`;

    const userPrompt = `
[질문]
${question}

[뽑힌 카드 목록]
${pairedList.map((c, i) => `${i + 1}. ${c.name} (${c.position})`).join("\n")}

위 내용을 기반으로 JSON 형태(A2 구조)로 출력하세요.
`;

    // ------------------------------
    // 🔥 OpenAI 호출 (절대 크래시 안 나도록 안정화)
    // ------------------------------
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    // ------------------------------
    // 🔥 출력 안전 추출 (response.output_text 사용)
    // ------------------------------
    const raw = response.output_text || "";

    // JSON 파싱 안정 처리
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: "AI JSON 파싱 실패",
        raw
      });
    }

    // ------------------------------
    // 🔒 구조 보정
    // ------------------------------
    if (!data.cards || !Array.isArray(data.cards)) data.cards = [];
    if (!data.overall) data.overall = { summary: "", advice: "" };

    // ------------------------------
    // 🔥 최종 응답
    // ------------------------------
    return res.status(200).json({
      cards: data.cards,
      overall: data.overall
    });

  } catch (error) {
    console.error("Tarot API Error:", error);

    return res.status(500).json({
      error: "서버 오류 발생",
      message: error?.message || "unknown error"
    });
  }
}
