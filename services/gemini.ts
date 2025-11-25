
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExamData } from "../types";

// Define the expected output schema
const examDataSchema: Schema = {
  type: Type.ARRAY,
  description: "List of exam results for subjects found in the document.",
  items: {
    type: Type.OBJECT,
    properties: {
      subject: { type: Type.STRING, description: "The name of the subject (e.g., 수학1, 국어, 제조화학, 인공지능일반). EXTRACT EXACTLY AS SHOWN." },
      average: { type: Type.NUMBER, description: "The average score (평균)." },
      totalStudents: { type: Type.NUMBER, description: "Total number of students (응시자 or 합계)." },
      gradeCounts: {
        type: Type.OBJECT,
        description: "Number of students in each score range. Use 0 if the specific range is not present.",
        properties: {
          score_90_100: { type: Type.INTEGER, description: "Count for 90-100 (90이상~100이하)" },
          score_80_89: { type: Type.INTEGER, description: "Count for 80-89 (80이상~90미만)" },
          score_70_79: { type: Type.INTEGER, description: "Count for 70-79" },
          score_60_69: { type: Type.INTEGER, description: "Count for 60-69" },
          score_50_59: { type: Type.INTEGER, description: "Count for 50-59" },
          score_40_49: { type: Type.INTEGER, description: "Count for 40-49" },
          score_30_39: { type: Type.INTEGER, description: "Count for 30-39" },
          score_20_29: { type: Type.INTEGER, description: "Count for 20-29" },
          score_10_19: { type: Type.INTEGER, description: "Count for 10-19" },
          score_0_9: { type: Type.INTEGER, description: "Count for 0-9" },
          score_under_60: { type: Type.INTEGER, description: "Explicit count for under 60 if grouped." }
        }
      }
    }
  }
};

export const extractDataFromImages = async (base64Images: string[]): Promise<ExamData[]> => {
  // STRICT API KEY ACCESS
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("API Key is missing. Please ensure process.env.API_KEY is set.");
    throw new Error("API Key configuration error. Please check environment variables.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Create parts array from images
  const parts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: img
    }
  }));

  // Add the prompt
  parts.push({
    // @ts-ignore
    text: `Analyze the provided exam analysis documents images as a SINGLE continuous sequence.
    
    TASK:
    Extract the subject name (교과목), average score (평균), total students (응시자/합계), and the distribution of students by score range.
    
    CRITICAL INSTRUCTIONS FOR ACCURACY:
    1. **EXACT TEXT EXTRACTION**: Extract the subject name EXACTLY as written in the image. 
       - Do NOT normalize, correct, or translate the subject name.
       - Do NOT guess. If it says "인공지능일반", return "인공지능일반".
       - If it says "제조화학", return "제조화학".
       - If it says "생산관리", return "생산관리".
       - Pay close attention to vocational subjects (e.g., 프로그래밍, 전자회로, 토목일반, 성공적인직업생활).
    2. **SCAN ALL PAGES**: The data often spans multiple pages. Process every single page and extract every row.
    3. **ALL ROWS**: Do not skip any rows.
    4. **COLUMNS**:
       - Subject is usually the first column.
       - Average is "평균".
       - Total is "응시자" or "합계".
       - Ranges are "90~100", "80~89", etc.
    5. **Under 60**: If the table has a column for "0~59", put that value in 'score_under_60'. Otherwise, extract the specific 10-point ranges.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: examDataSchema,
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI.");

    // Clean Markdown code blocks if present (common issue with some models)
    if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
        const rawData = JSON.parse(jsonText);
        return rawData;
    } catch (parseError) {
        console.error("JSON Parse Error. Raw Text:", jsonText);
        throw new Error("Failed to parse AI response. The extracted data was not valid JSON.");
    }

  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    // enhance error message for UI
    if (error.message.includes("401") || error.message.includes("key")) {
        throw new Error("Invalid API Key. Please check your settings.");
    }
    throw error;
  }
};
