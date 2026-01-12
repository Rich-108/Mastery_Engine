
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { FileData } from "../types";

/**
 * Maps technical API errors to student-friendly academic feedback.
 * 401 and 403 errors are common if the API_KEY is missing or invalid in the environment.
 */
const mapErrorToUserMessage = (error: any): string => {
  const errorMessage = error?.message?.toLowerCase() || "";
  
  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return "The Engine is processing a high volume of requests. Please wait a few seconds.";
  }
  if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
    return "This inquiry was filtered for safety. Please focus on academic exploration.";
  }
  if (errorMessage.includes("api key") || errorMessage.includes("invalid") || errorMessage.includes("401") || errorMessage.includes("403")) {
    return "There's an issue with the Engine's authorization. Please ensure the environment configuration is correct.";
  }
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "Unable to reach the Engine. Please check your internet connection.";
  }
  if (errorMessage.includes("500") || errorMessage.includes("rpc failed")) {
    return "The Engine encountered a server connectivity issue. Please try again in a moment.";
  }
  
  return "The Mastery Engine encountered an unexpected error. Please refresh your session.";
};

const trimHistory = (history: { role: 'user' | 'model', parts: { text: string }[] }[], limit: number = 8) => {
  return history.length <= limit ? history : history.slice(-limit);
};

export const getGeminiResponse = async (
  userMessage: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  attachment?: FileData,
  modelName: string = 'gemini-3-flash-preview'
) => {
  // Initialize right before call to ensure up-to-date process.env access
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const userParts: any[] = [{ text: userMessage }];
    
    if (attachment) {
      userParts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType
        }
      });
    }

    const trimmedHistory = trimHistory(history);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...trimmedHistory,
        { role: 'user', parts: userParts }
      ],
      config: {
        systemInstruction: `You are Mastery Engine, a conceptual tutor.
        
        GREETING PROTOCOL:
        If the input is a greeting or general talk, be warm and extremely brief (1 sentence). No 4-step structure.
        
        SUBJECT INQUIRY PROTOCOL:
        For academic subjects, use this structure:
        1. THE CORE PRINCIPLE: Explain the logic simply.
        2. AN ANALOGY: Use a real-world comparison.
        3. THE APPLICATION: Solve the specific problem step-by-step.
        4. CONCEPT MAP: ONLY generate a Mermaid diagram if the process is extremely complex (more than 3 interacting parts). Otherwise, skip this section.
        
        STYLING CONSTRAINTS:
        - NEVER use markdown symbols like #, *, **, _, or >.
        - Use ALL CAPS for section titles only.
        - Use double line breaks between paragraphs.
        - No bullet points; use simple spaces for indentation.
        - Finish with: [RELATED_TOPICS: Topic A, Topic B, Topic C]`,
        temperature: 0.7,
      },
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(mapErrorToUserMessage(error));
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const cleanText = text
      .replace(/```mermaid[\s\S]*?```/g, '')
      .replace(/\[RELATED_TOPICS:[\s\S]*?\]/g, '')
      .replace(/[#*`]/g, '')
      .trim();

    if (!cleanText) return undefined;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    return undefined;
  }
};
