
import { GoogleGenAI, Modality } from "@google/genai";
import { FileData } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Neural synchronization timeout")), 20000)
      );
      return await Promise.race([fn(), timeoutPromise]) as T;
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed:`, error);
      
      const status = error.status || (error.response ? error.response.status : null);
      if (status === 429 || (status && status >= 500)) {
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
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("MISSING_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  return withRetry(async () => {
    const contents: any[] = [];
    
    history.forEach((h) => {
      const role = h.role === 'assistant' ? 'model' : 'user';
      const text = (h.content || "").trim();
      if (!text) return;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += "\n\n" + text;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    });

    const currentParts: any[] = [];
    if (userMessage.trim()) currentParts.push({ text: userMessage.trim() });
    if (attachment) {
      currentParts.push({
        inlineData: { data: attachment.data, mimeType: attachment.mimeType }
      });
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts.push(...currentParts);
    } else {
      contents.push({ role: 'user', parts: currentParts });
    }

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgraded to Pro for better conceptual depth
      contents,
      config: {
        systemInstruction: `You are Mastery Engine, an elite conceptual architect. 
        
        CORE MISSION: 
        When a student asks about a subject or question, DO NOT just give the answer. 
        Instead, you MUST first provide the underlying CONCEPT. Deconstruct the logic into first principles.

        STRICT OPERATING PROTOCOLS:
        1. NO asterisks (*), NO hashes (#). Use PLAIN TEXT ONLY.
        2. Use the exact numbered sections below.
        3. Prioritize conceptual depth over simple answers.

        RESPONSE STRUCTURE:
        
        1. THE CORE PRINCIPLE
        [Identify the fundamental law or logic that governs this topic. Why does it exist?]

        2. MENTAL MODEL (ANALOGY)
        [Explain the concept using a real-world analogy that makes it intuitive.]

        3. THE DIRECT ANSWER
        [Address the student's specific question using the logic established in step 1.]

        4. CONCEPT MAP
        [A simple Mermaid flowchart showing the hierarchy of ideas.]

        EXPANSION_NODES: [Related Concept A, Related Concept B, Related Concept C]`,
        temperature: 0.6,
      },
    });

    if (!response.text) throw new Error("EMPTY_RESPONSE");
    return response.text.trim();
  });
};

export const getGeminiTTS = async (text: string, voiceName: string = 'Kore') => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") return null;
  
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const prepareSpeechText = (text: string): string => {
  return text
    .replace(/EXPANSION_NODES[\s\S]*?$/g, '')
    .replace(/flowchart[\s\S]*?$/gi, '')
    .replace(/graph[\s\S]*?$/gi, '')
    .replace(/[0-9]\.\s[A-Z\s]+/g, '') 
    .replace(/[*#]/g, '') 
    .trim();
};
