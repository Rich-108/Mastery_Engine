
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  return withRetry(async () => {
    const contents: any[] = [];
    
    // Process and Sanitize History to ensure strictly alternating turns (U-M-U-M)
    history.forEach((h) => {
      const role = h.role === 'assistant' ? 'model' : 'user';
      const text = (h.content || "").trim();
      if (!text) return;

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += "\n\n" + text;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    });

    const currentParts: any[] = [];
    if (userMessage.trim()) currentParts.push({ text: userMessage.trim() });
    if (attachment) {
      currentParts.push({
        inlineData: {
          data: attachment.data,
          mimeType: attachment.mimeType
        }
      });
    }

    if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      contents[contents.length - 1].parts.push(...currentParts);
    } else {
      contents.push({ role: 'user', parts: currentParts });
    }

    // API strict requirement: conversation must start with a user turn
    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift();
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: `You are Mastery Engine, an elite conceptual architect. 
          
          STRICT OPERATING PROTOCOLS:
          1. NEVER use asterisks (*) for bold/italic.
          2. NEVER use hashes (#) for headers.
          3. Use plain text with the specific numbered sections provided below.
          4. If a student asks a question, deconstruct the underlying CONCEPT before giving the direct answer.

          STRICT RESPONSE STRUCTURE (Use exactly this plain text format):
          
          1. THE CORE PRINCIPLE
          [A profound paragraph deconstructing the foundational conceptual logic. Use plain text only.]

          2. MENTAL MODEL (ANALOGY)
          [A vivid analogy making the concept concrete. Use plain text only.]

          3. THE DIRECT ANSWER
          [The precise answer to the student's inquiry. Use plain text only.]

          4. CONCEPT MAP
          [Provide a COMPACT Mermaid flowchart. Max 4-5 nodes.
          - Start with 'flowchart TD' on its own line.
          - Use simple IDs like A, B, C.
          - Wrap node labels in quotes.
          - Add blank lines for readability.
          ]

          EXPANSION_NODES: [Topic 1, Topic 2, Topic 3]`,
          temperature: 0.7,
        },
      });

      if (!response || !response.text) throw new Error("Neural synthesis failed to return content.");
      return response.text.trim();
    } catch (apiError: any) {
      console.error("Mastery Engine API Error:", apiError);
      throw apiError;
    }
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
    .replace(/EXPANSION_NODES[\s\S]*?$/g, '')
    .replace(/flowchart[\s\S]*?$/gi, '')
    .replace(/graph[\s\S]*?$/gi, '')
    .replace(/[0-9]\.\s[A-Z\s]+/g, '') 
    .replace(/[*#]/g, '') // Stripping any residual symbols for speech
    .trim();
};
