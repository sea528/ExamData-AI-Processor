import { GoogleGenAI } from "@google/genai";

// API 키를 안전하게 가져오고 정제하는 헬퍼 함수
const getApiKey = (): string => {
  let key = "";

  // 1. Vite 및 최신 프론트엔드 환경 변수 우선 확인
  const envCandidates = [
    // @ts-ignore
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY : undefined,
    // @ts-ignore
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_KEY : undefined,
    // @ts-ignore
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.API_KEY : undefined,
    // @ts-ignore
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.REACT_APP_API_KEY : undefined,
    // @ts-ignore
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.NEXT_PUBLIC_API_KEY : undefined,
  ];

  // 2. process.env 확인 (레거시, Node.js, 일부 빌드 시스템)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
       // @ts-ignore
       envCandidates.push(process.env.VITE_GEMINI_API_KEY);
       // @ts-ignore
       envCandidates.push(process.env.VITE_API_KEY);
       // @ts-ignore
       envCandidates.push(process.env.API_KEY);
       // @ts-ignore
       envCandidates.push(process.env.REACT_APP_API_KEY);
    }
  } catch (e) {}

  // 유효한 첫 번째 키 선택
  key = envCandidates.find(k => k && typeof k === 'string') || "";

  // 3. 강력한 정제 (Sanitization)
  if (key) {
    // 혹시 모를 URL 인코딩 해제
    try { key = decodeURIComponent(key); } catch (e) {}

    // 따옴표(", '), 공백(\s), 세미콜론(;), 줄바꿈 등 제거
    key = key.replace(/["'\s;\n\r]/g, "");

    // 사용자가 실수로 "API_KEY=AIza..." 형태로 값 전체를 복사해 넣었을 경우 처리
    if (key.includes("=")) {
        const parts = key.split("=");
        // 등호 뒤의 값이 실제 키일 가능성이 높음
        if (parts.length > 1) {
            key = parts[parts.length - 1];
        }
    }
  }

  // 디버깅용 로그 (키 유출 방지를 위해 일부만 출력)
  if (key) {
      console.log(`[ExamData AI] API Key detected. Length: ${key.length}, Prefix: ${key.substring(0, 4)}***`);
  } else {
      console.warn("[ExamData AI] No API Key found in environment variables.");
  }

  return key;
};

export async function extractDataFromImages(images: string[]) {
  const apiKey = getApiKey();

  // 기본 유효성 검사
  if (!apiKey) {
    throw new Error("API 키가 감지되지 않았습니다. Netlify Site Settings > Environment Variables에서 'API_KEY' 또는 'VITE_API_KEY'를 설정해주세요.");
  }

  // 구글 API 키 형식 검사 (AIza로 시작하지 않으면 경고하지만 막지는 않음 - 프록시 등 예외 상황 고려)
  if (!apiKey.startsWith("AIza")) {
     console.warn("경고: API 키가 'AIza'로 시작하지 않습니다. 키 값이 올바른지 확인하세요. 현재 키 값(일부): " + apiKey.substring(0, 3) + "...");
  }

  // 최신 SDK 초기화
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
    // 모델 호출
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
    
    // 데이터 보정
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
    console.error("Gemini API Error Detail:", error);
    
    let userMessage = "AI 분석 중 오류가 발생했습니다.";
    
    // 에러 메시지 분석
    const errorString = error.toString();
    if (errorString.includes("400") || errorString.includes("INVALID_ARGUMENT") || errorString.includes("API key not valid")) {
      userMessage = "API 키 형식이 올바르지 않습니다 (400 Invalid Argument). Netlify 변수 설정에서 값에 따옴표(\")나 변수명(API_KEY=)이 포함되어 있지 않은지 확인하세요.";
    } else if (errorString.includes("403")) {
      userMessage = "API 키 권한이 없거나 만료되었습니다 (403 Forbidden).";
    } else if (errorString.includes("429")) {
      userMessage = "요청이 너무 많습니다 (429 Too Many Requests). 잠시 후 다시 시도해주세요.";
    } else if (error.message) {
      userMessage += ` (${error.message})`;
    }

    throw new Error(userMessage);
  }
}