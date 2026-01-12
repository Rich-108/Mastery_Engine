
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { FileData } from "../types";

/**
 * Maps technical API errors to student-friendly academic feedback.
 * Specifically handles Netlify/Deployment authorization issues.
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
    return "Authorization failed. If you are on Netlify, ensure the API_KEY environment variable is set in your Site Settings.";
  }
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "Unable to reach the Engine. Please check your internet connection.";
  }
  if (errorMessage.includes("500") || errorMessage.includes("rpc failed")) {
    return "The Engine encountered a server connectivity issue. Your current chat is preserved; please try the last request again.";
  }
  
  return "The Mastery Engine encountered an unexpected error. Your conversation history is still safe.";
};

/**
 * Increased limit to 25 messages to satisfy the request for more "available" context.
 */
const trimHistory = (history: { role: 'user' | 'model', parts: { text: string }[] }[], limit: number = 25) => {
  return history.length <= limit ? history : history.slice(-limit);
};

export const getGeminiResponse = async (
  userMessage: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  attachment?: FileData,
  modelName: string = 'gemini-3-flash-preview'
) => {
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
        If the input is a greeting, respond with 1 warm sentence.
        
        CONTEXTUAL AWARENESS:
        You have access to the full conversation history. Always refer back to previous concepts if the student asks follow-up questions. Do not 'auto-clear' your memory.
        
        SUBJECT INQUIRY PROTOCOL:
        Use this structure for academic topics:
        1. THE CORE PRINCIPLE: Clear, foundational logic.
        2. AN ANALOGY: A vivid comparison.
        3. THE APPLICATION: Step-by-step solution.
        4. CONCEPT MAP: Only use Mermaid diagrams for processes with 4+ steps.
        
        STYLING CONSTRAINTS:
        - NO markdown symbols (#, *, **, _, >).
        - ALL CAPS for section headers.
        - Double line breaks between paragraphs.
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
