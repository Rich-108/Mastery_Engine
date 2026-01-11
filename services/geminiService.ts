
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { FileData } from "../types";

const API_KEY = process.env.API_KEY || '';

/**
 * Maps technical API errors to student-friendly academic feedback
 */
const mapErrorToUserMessage = (error: any): string => {
  const errorMessage = error?.message?.toLowerCase() || "";
  
  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return "The Engine is processing a high volume of requests. Please wait a few seconds before asking your next question.";
  }
  if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
    return "This inquiry was filtered for safety. Please rephrase your question to focus on academic and conceptual exploration.";
  }
  if (errorMessage.includes("api key") || errorMessage.includes("invalid")) {
    return "There's an issue with the Engine's authorization. Please contact support or check your connection.";
  }
  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "Unable to reach the Engine. Please check your internet connection and try again.";
  }
  if (errorMessage.includes("500") || errorMessage.includes("rpc failed") || errorMessage.includes("xhr error")) {
    return "The Engine encountered a server-side connectivity issue. This is usually transient—please try your request again in a moment.";
  }
  
  return "The Mastery Engine encountered an unexpected hiccup. Please try refreshing your session.";
};

/**
 * Limit history to the last N messages to avoid payload limits and proxy timeouts
 */
const trimHistory = (history: { role: 'user' | 'model', parts: { text: string }[] }[], limit: number = 10) => {
  if (history.length <= limit) return history;
  return history.slice(-limit);
};

export const getGeminiResponse = async (
  userMessage: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  attachment?: FileData,
  modelName: string = 'gemini-3-flash-preview'
) => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
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

    // Defensive check: if history is too long, trim it
    const trimmedHistory = trimHistory(history);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...trimmedHistory,
        { role: 'user', parts: userParts }
      ],
      config: {
        systemInstruction: `You are Mastery Engine, a specialized conceptual tutor designed to help students achieve deep understanding.
        
        CRITICAL CORE DIRECTIVE: Never provide a direct answer immediately. You must first break down the underlying concept or logic.
        
        RESPONSE STRUCTURE:
        1. THE CORE PRINCIPLE: Explain the 'Why' and the fundamental logic.
        2. AN ANALOGY: Provide a vivid comparison.
        3. THE APPLICATION: Specifically solve the student's question based on the logic above.
        4. CONCEPT MAP: (Optional) Visualize the process with simple Mermaid.js.
        
        Always finish with: [RELATED_TOPICS: Topic A, Topic B, Topic C]`,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    return response.text || "The Engine generated an empty response. Please try rephrasing your inquiry.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(mapErrorToUserMessage(error));
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  try {
    // Clean text: strip diagrams, related topics, and markdown symbols
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
    console.error("Speech Generation Error:", error);
    // Silent fail for speech, as it's an optional enhancement
    return undefined;
  }
};
