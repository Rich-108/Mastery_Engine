
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
  attachment?: FileData,
  modelName: string = 'gemini-3-pro-preview',
  useThinking: boolean = false
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

    // Determine config based on model type and thinking flag
    const isLite = modelName.includes('lite');
    const actualModel = useThinking ? 'gemini-3-pro-preview' : modelName;

    const response = await ai.models.generateContent({
      model: actualModel,
      contents,
      config: {
        systemInstruction: `You are Mastery Engine, a world-class conceptual tutor. 
        
        GOAL: Your primary mission is to ensure the user truly masters the "Why" behind any topic through deep learning.
        
        STRICT FORMATTING RULE:
        - DO NOT USE asterisks (*) or hash symbols (#) in your responses.
        - NO Markdown formatting for bold, italics, or headers using those symbols.
        - Use plain text only. Use capitalization for emphasis if necessary.
        
        INSTRUCTIONS:
        1. CONCEPT FIRST: Whenever a user asks a question OR says hello, always provide a foundational conceptual perspective first. If a user says "hi" or "hello", briefly explain the fundamental concept of inquiry, curiosity, or the nature of mental models before asking what they want to learn.
        2. ANALOGIES: Use clear, relatable analogies to bridge the gap between abstract ideas and common knowledge.
        3. VISUALS: Use Mermaid diagrams (code blocks starting with \`\`\`mermaid) to visualize processes, hierarchies, or relationships whenever helpful.
        4. NATURAL LANGUAGE: Avoid unnecessary symbols, operators, or complex technical jargon unless essential. Speak naturally and clearly.
        5. DEEP LEARNING NODES: Always end your response with a list of suggested deep-dives using the exact phrase DEEP_LEARNING_TOPICS followed by the topics separated by commas. Do not use any special characters in the list.
        
        Example: DEEP_LEARNING_TOPICS Quantum State, Wave Function, Probability Density`,
        temperature: 0.7,
        // Apply thinking budget if explicitly requested or for Pro model
        ...(useThinking ? { thinkingConfig: { thinkingBudget: 32768 } } : 
           (isLite ? { thinkingConfig: { thinkingBudget: 0 } } : {})),
      },
    });

    const text = response.text;
    if (!text) throw new Error("Connection interrupted. Please try again.");
    return text;
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
    .replace(/```mermaid[\s\S]*?```/g, 'Visual diagram follows.')
    .replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '')
    .replace(/[#*`]/g, '')
    .trim();
};
