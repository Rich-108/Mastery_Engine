
import Groq from "groq-sdk";
import { FileData } from "../types";

/**
 * Helper to sleep for a specific duration (ms) for exponential backoff.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps a function with automatic retry logic using exponential backoff.
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Groq specific rate limit handling (Status 429) or server errors
      if (error.status === 429 || error.status >= 500) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`Mastery Engine (Groq): Service busy. Retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

/**
 * Core function to interface with Groq API.
 * Replaces Gemini implementation with Groq SDK.
 */
export const getGeminiResponse = async (
  userMessage: string, 
  history: { role: 'user' | 'assistant', content: string }[],
  attachment?: FileData,
  modelName: string = 'llama-3.3-70b-versatile'
) => {
  // Always use a vision-capable model if an attachment is provided
  const effectiveModel = attachment ? 'llama-3.2-11b-vision-preview' : modelName;
  
  const groq = new Groq({ 
    apiKey: process.env.API_KEY,
    dangerouslyAllowBrowser: true
  });
  
  return withRetry(async () => {
    const messages: any[] = [
      {
        role: "system",
        content: `You are Mastery Engine, a world-class conceptual tutor.
        
        PEDAGOGICAL MANDATE:
        If a student asks a question, you MUST first explain the underlying CONCEPT and foundational logic. 
        Do not provide raw answers without establishing theoretical mastery first.
        
        RESPONSE STRUCTURE:
        1. THE CORE PRINCIPLE: Explain the foundational "why" of the topic.
        2. AN ANALOGY: Provide a simple, relatable mental model.
        3. THE APPLICATION: Step-by-step logic or solution.
        4. CONCEPT MAP: A Mermaid diagram visualizing the concept relationships.
        
        CONSTRAINTS:
        - USE ALL CAPS for these 4 headers.
        - Avoid excessive bolding or complex markdown.
        - End with: [RELATED_TOPICS: Topic A, Topic B, Topic C]`
      }
    ];

    // Add conversation history
    history.forEach(h => {
      messages.push({
        role: h.role,
        content: h.content
      });
    });

    // Add current message with potential attachment
    if (attachment) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userMessage || "Analyze this image conceptually." },
          {
            type: "image_url",
            image_url: {
              url: `data:${attachment.mimeType};base64,${attachment.data}`
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: userMessage
      });
    }

    const completion = await groq.chat.completions.create({
      messages,
      model: effectiveModel,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      stream: false,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) throw new Error("Groq response was empty. Please check connection.");
    return responseText;
  });
};

/**
 * Strips UI elements for TTS.
 */
export const prepareSpeechText = (text: string): string => {
  return text
    .replace(/```mermaid[\s\S]*?```/g, '')
    .replace(/\[RELATED_TOPICS:[\s\S]*?\]/g, '')
    .replace(/[#*`]/g, '')
    .replace(/1\. THE CORE PRINCIPLE:/g, 'The core principle.')
    .replace(/2\. AN ANALOGY:/g, 'As an analogy.')
    .replace(/3\. THE APPLICATION:/g, 'Here is the application.')
    .replace(/4\. CONCEPT MAP:/g, '')
    .trim();
};
