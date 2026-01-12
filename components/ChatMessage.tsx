
import React, { useState, useRef } from 'react';
import { Message } from '../types';
import Diagram from './Diagram';
import { generateSpeech } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
  onSelectTopic?: (topic: string) => void;
  isDarkMode?: boolean;
}

const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

/**
 * Strips common markdown symbols that contribute to visual clutter in this specific app context.
 */
const sanitizeText = (text: string) => {
  return text
    .replace(/[#*>`_]/g, '') // Remove standard markdown operators
    .trim();
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSelectTopic, isDarkMode }) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const handleCopy = async () => {
    try {
      const cleanContent = message.content
        .replace(/```mermaid[\s\S]*?```/g, '[Diagram]')
        .replace(/\[RELATED_TOPICS:[\s\S]*?\]/g, '');
      await navigator.clipboard.writeText(sanitizeText(cleanContent));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleToggleSpeech = async () => {
    if (isSpeaking) {
      sourceNodeRef.current?.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeechLoading(true);
    try {
      const base64Audio = await generateSpeech(message.content);
      if (!base64Audio) throw new Error("Failed to generate speech");

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioData = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsSpeaking(false);
      };

      sourceNodeRef.current = source;
      source.start();
      setIsSpeaking(true);
    } catch (err) {
      console.error("Speech playback error:", err);
    } finally {
      setIsSpeechLoading(false);
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(feedback === type ? null : type);
  };

  const extractTopics = (content: string) => {
    const match = content.match(/\[RELATED_TOPICS:\s*(.*?)\]/);
    if (match && match[1]) {
      return match[1].split(',').map(t => t.trim());
    }
    return [];
  };

  const topics = isAssistant ? extractTopics(message.content) : [];
  const mainContent = message.content.replace(/\[RELATED_TOPICS:[\s\S]*?\]/g, '').trim();

  const renderConceptualBody = (text: string) => {
    const sections = text.split(/(1\. THE CORE PRINCIPLE:|2\. AN ANALOGY:|3\. THE APPLICATION:|4\. CONCEPT MAP:)/g);
    
    if (sections.length <= 1) {
      return <div className="whitespace-pre-wrap font-normal leading-relaxed text-slate-700 dark:text-slate-300">{sanitizeText(text)}</div>;
    }

    return (
      <div className="space-y-6">
        {sections.map((part, i) => {
          const partTrimmed = part.trim();
          if (!partTrimmed) return null;

          // Subtle Header Styles - removing clutter icons, using clean typography
          if (partTrimmed === '1. THE CORE PRINCIPLE:') {
            return (
              <div key={i} className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest mt-6 border-b border-indigo-50 dark:border-indigo-900/20 pb-1">
                Foundational Logic
              </div>
            );
          }
          if (partTrimmed === '2. AN ANALOGY:') {
            return (
              <div key={i} className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest mt-6 border-b border-emerald-50 dark:border-emerald-900/20 pb-1">
                Mental Model
              </div>
            );
          }
          if (partTrimmed === '3. THE APPLICATION:') {
            return (
              <div key={i} className="text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-widest mt-6 border-b border-amber-50 dark:border-amber-900/20 pb-1">
                Step by Step Solution
              </div>
            );
          }
          if (partTrimmed === '4. CONCEPT MAP:') {
            return (
              <div key={i} className="text-rose-600 dark:text-rose-400 font-bold text-[10px] uppercase tracking-widest mt-6 border-b border-rose-50 dark:border-rose-900/20 pb-1">
                Visual Workflow
              </div>
            );
          }
          
          // Mermaid rendering
          if (partTrimmed.startsWith('```mermaid')) {
             const chart = partTrimmed.replace(/```mermaid/g, '').replace(/```/g, '').trim();
             return <Diagram key={i} chart={chart} isDarkMode={isDarkMode} />;
          }

          // Content body
          const isHeaderMarker = ['1. THE CORE PRINCIPLE:', '2. AN ANALOGY:', '3. THE APPLICATION:', '4. CONCEPT MAP:'].includes(partTrimmed);
          if (isHeaderMarker) return null;

          const previousPart = i > 0 ? sections[i-1].trim() : '';
          const isContentUnderHeader = ['1. THE CORE PRINCIPLE:', '2. AN ANALOGY:', '3. THE APPLICATION:', '4. CONCEPT MAP:'].includes(previousPart);
          
          return (
            <div key={i} className={`whitespace-pre-wrap font-normal leading-7 text-slate-700 dark:text-slate-300 ${isContentUnderHeader ? 'pl-4' : ''}`}>
              {sanitizeText(partTrimmed)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderBody = () => {
    return (
      <div className="space-y-4">
        {message.attachment && (
          <div className="mb-4">
            {message.attachment.mimeType.startsWith('image/') ? (
              <img 
                src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`} 
                alt="Uploaded source content" 
                className="max-w-full rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 max-h-80 object-contain bg-slate-50 dark:bg-slate-800"
              />
            ) : (
              <div className="flex items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Analysis input received</span>
              </div>
            )}
          </div>
        )}
        {isAssistant ? renderConceptualBody(mainContent) : <div className="whitespace-pre-wrap font-normal leading-relaxed">{sanitizeText(mainContent)}</div>}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-8 ${isAssistant ? 'justify-start' : 'justify-end'}`} role="article">
      <div className={`flex max-w-[95%] md:max-w-[85%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm transition-colors mt-1
          ${isAssistant ? 'bg-indigo-600 mr-3' : 'bg-slate-500 ml-3'}`}>
          {isAssistant ? 'ME' : 'U'}
        </div>
        <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
          <div className={`relative px-6 py-5 rounded-2xl text-[14px] shadow-sm group transition-all duration-300
            ${isAssistant 
              ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-none' 
              : 'bg-indigo-600 text-white rounded-tr-none'}`}>
            
            <div className="max-w-none">
              {renderBody()}
            </div>

            {isAssistant && topics.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-50 dark:border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3">
                  Deepen Learning
                </span>
                <nav className="flex flex-wrap gap-2" aria-label="Suggested concepts">
                  {topics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectTopic?.(topic)}
                      className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white hover:border-indigo-600 transition-all active:scale-95"
                    >
                      {topic}
                    </button>
                  ))}
                </nav>
              </div>
            )}
            
            {isAssistant && (
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => handleFeedback('up')}
                    aria-label="Helpful"
                    className={`p-1 transition-colors ${feedback === 'up' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700 hover:text-indigo-500'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={feedback === 'up' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.708C19.743 10 20.5 10.842 20.5 11.854c0 .487-.194.948-.533 1.287l-6.039 6.039a2.103 2.103 0 01-1.487.616H8.5c-1.105 0-2-.895-2-2v-7c0-.53.21-1.04.586-1.414l4.828-4.828a2 2 0 012.828 0c.2.2.343.435.414.69l.844 3.376c.07.28.07.56.07.842V10z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={handleToggleSpeech}
                    disabled={isSpeechLoading}
                    className={`p-1 transition-colors ${isSpeaking ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-700 hover:text-indigo-500'}`}
                  >
                    {isSpeechLoading ? (
                      <div className="h-3 w-3 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-[9px] font-bold uppercase tracking-wider text-slate-300 dark:text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  {copied ? <span>Copied</span> : <span>Copy</span>}
                </button>
              </div>
            )}
          </div>
          <time className="text-[9px] text-slate-400 dark:text-slate-600 mt-2 uppercase tracking-widest font-bold">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
