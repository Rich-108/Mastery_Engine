
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
  // Rigorous check for the API Key - explicitly checking for string "undefined" which can be baked in by Vite
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
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
      // Fix: explicitly define role as 'user' for current message as 'role' variable from the history loop is not in scope
      contents.push({ role: 'user', parts: currentParts });
    }

    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    // Using gemini-3-pro-preview for high-quality conceptual deconstruction
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents,
      config: {
        systemInstruction: `You are Mastery Engine, an elite conceptual architect. 
        
        STRICT OPERATIONAL DIRECTIVE:
        When a student asks a question or proposes a subject, you MUST provide the underlying CONCEPT first. 
        Do not skip straight to the answer. Deconstruct the logic into its most fundamental first principles.

        STRICT FORMATTING PROTOCOLS:
        1. NO markdown headers (#), NO bold/italic asterisks (*).
        2. Use only PLAIN TEXT with the numbered sections below.
        3. Maintain extreme conceptual depth.

        RESPONSE TEMPLATE:
        
        1. THE CORE PRINCIPLE
        [Identify the most abstract, fundamental logic or law that governs this entire topic. Explain the 'why' at a structural level.]

        2. MENTAL MODEL (ANALOGY)
        [Create a vivid, intuitive analogy that anchors the abstract principle into concrete reality.]

        3. THE DIRECT ANSWER
        [Apply the established logic to provide the specific, detailed answer to the user's inquiry.]

        4. CONCEPT MAP
        [A simple Mermaid flowchart showing the hierarchy of ideas.]

        EXPANSION_NODES: [Topic A, Topic B, Topic C]`,
        temperature: 0.65,
      },
    });

    if (!response.text) throw new Error("EMPTY_RESPONSE");
    return response.text.trim();
  });
};

export const getGeminiTTS = async (text: string, voiceName: string = 'Kore') => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") return null;
  
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
