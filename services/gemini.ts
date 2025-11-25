import { GoogleGenAI } from "@google/genai";

// API 키를 안전하게 가져오는 헬퍼 함수
const getApiKey = () => {
  // 1. Vite 환경 변수 확인 (Netlify 등)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
      // @ts-ignore
      if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {}

  // 2. process.env 확인 (빌드 타임 치환)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
       // @ts-ignore
       if (process.env.API_KEY) return process.env.API_KEY;
       // @ts-ignore
       if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}

  return "";
};

export async function extractDataFromImages(images: string[]) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("API 키를 찾을 수 없습니다. Netlify 설정에서 'VITE_GEMINI_API_KEY' 또는 'API_KEY'를 추가해주세요.");
  }

  // 최신 SDK 초기화 방식
  const ai = new GoogleGenAI({ apiKey: apiKey });

  // 텍스트 프롬프트 구성
  const promptText = `
    다음은 지필고사 분석 자료의 이미지들이다. 
    이미지에 있는 "교과목별 성적 분석표" 또는 유사한 표를 찾아 다음 정보를 JSON 형식으로 정확하게 추출하라.
    
    [중요 규칙]
    1. 과목명(subject)은 표에 적힌 텍스트 그대로 정확하게 추출해라. "인공지능일반"을 "생산관리"로 바꾸거나 추측하지 마라.
    2. 모든 페이지를 분석하여 누락되는 과목이 없도록 해라. (제조화학, 기계일반 등 직업계고 전문교과 포함)
    3. 점수 구간은 다음 필드에 매핑해라:
       - "90이상 ~ 100이하" -> score_90_100
       - "80이상 ~ 90미만" -> score_80_89
       - "70이상 ~ 80미만" -> score_70_79
       - "60이상 ~ 70미만" -> score_60_69
       - 60점 미만의 모든 구간(50~60, 40~50, ... 0~10)의 합계 -> score_under_60
    
    [출력 스키마 - JSON 배열]
    [
      {
        "subject": "과목명",
        "average": 0.0,
        "totalStudents": 0,
        "gradeCounts": {
          "score_90_100": 0,
          "score_80_89": 0,
          "score_70_79": 0,
          "score_60_69": 0,
          "score_under_60": 0
        }
      }
    ]
    
    오직 JSON 배열만 반환하고, 마크다운 포맷(\`\`\`json)은 포함하지 마라.
  `;

  // 이미지 파트 구성
  const parts = [
    { text: promptText },
    ...images.map((base64Data) => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    }))
  ];

  try {
    // 최신 SDK 모델 호출 (gemini-2.5-flash 사용)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { parts: parts },
      config: {
        responseMimeType: "application/json"
      }
    });

    // 응답 텍스트 추출 및 정제
    let text = response.text || "";
    
    // 마크다운 제거 (안전 장치)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const data = JSON.parse(text);
    
    // 데이터 보정 (API가 가끔 누락하는 필드 채우기)
    const normalizedData = (Array.isArray(data) ? data : [data]).map((item: any) => ({
        subject: item.subject || "Unknown",
        average: Number(item.average) || 0,
        totalStudents: Number(item.totalStudents) || 0,
        gradeCounts: {
            score_90_100: Number(item.gradeCounts?.score_90_100) || 0,
            score_80_89: Number(item.gradeCounts?.score_80_89) || 0,
            score_70_79: Number(item.gradeCounts?.score_70_79) || 0,
            score_60_69: Number(item.gradeCounts?.score_60_69) || 0,
            score_under_60: Number(item.gradeCounts?.score_under_60) || 
                            (Number(item.gradeCounts?.score_50_59) || 0) + 
                            (Number(item.gradeCounts?.score_40_49) || 0) +
                            (Number(item.gradeCounts?.score_30_39) || 0) +
                            (Number(item.gradeCounts?.score_20_29) || 0) +
                            (Number(item.gradeCounts?.score_10_19) || 0) +
                            (Number(item.gradeCounts?.score_0_9) || 0)
        }
    }));

    return normalizedData;

  } catch (error: any) {
    console.error("Gemini Error:", error);
    let errorMsg = "AI 분석 실패";
    if (error.message) errorMsg += `: ${error.message}`;
    throw new Error(errorMsg);
  }
}