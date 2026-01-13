import { GoogleGenAI, Modality } from "@google/genai";
import { FileData } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (error.status === 429 || error.status >= 500) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const getGeminiResponse = async (
  userMessage: string, 
  history: { role: 'user' | 'assistant', content: string }[],
  attachment?: FileData
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  return withRetry(async () => {
    const formattedHistory = history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));

    const contents = [...formattedHistory];
    const parts: any[] = [{ text: userMessage }];

    if (attachment) {
      parts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType
        }
      });
    }

    contents.push({ role: 'user', parts });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction: `You are Mastery Engine, an elite conceptual architect for students. 
        
        STRICT OPERATING PROTOCOL:
        When a student asks about a subject, your primary goal is to provide the underlying CONCEPT before the specific answer. 
        Decompose complexity into first principles.

        STRICT RESPONSE STRUCTURE:
        1. THE CORE PRINCIPLE
        [Explain the foundational "why" or logic of the subject in one strong paragraph.]

        2. MENTAL MODEL (ANALOGY)
        [Provide a vivid analogy that maps this complex subject to a simple everyday experience.]

        3. THE DIRECT ANSWER
        [Address the specific query with technical precision but conceptual clarity.]

        4. CONCEPT MAP
        [A text-based hierarchical map using indentation (2 spaces) and arrows (->).
        Example:
        Concept
          -> Primary Component
             -> Detail 1
          -> Secondary Component]

        VISUAL STYLE:
        - Use standard sentence case.
        - Double line breaks between sections.
        - Plain text only. No markdown symbols like * or #.

        DEEP_LEARNING_TOPICS: [List 3 advanced sub-topics related to the subject]`,
        temperature: 0.7,
      },
    });

    const text = response.text || "";
    return text.replace(/[*#]/g, '').trim();
  });
};

export const getGeminiTTS = async (text: string, voiceName: string = 'Kore') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const prepareSpeechText = (text: string): string => {
  return text
    .replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '')
    .replace(/[0-9]\.\s[A-Z\s]+/g, '') 
    .trim();
};