import React, { useState, useRef } from 'react';
import { Message } from '../types';
import { prepareSpeechText, getGeminiTTS } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';

interface ChatMessageProps {
  message: Message;
  onSelectTopic?: (topic: string) => void;
  onRefineConcept?: (lens: string) => void;
  onHarvestConcept?: (content: string) => void;
  isDarkMode?: boolean;
}

const sanitizeText = (text: string) => {
  return text.replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '').trim();
};

const SimpleFlow: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  return (
    <div className="my-6 space-y-3 pl-2 border-l-2 border-indigo-100 dark:border-indigo-900/30">
      {lines.map((line, i) => {
        const indentLevel = Math.max(0, Math.floor(line.search(/\S/) / 2));
        const content = line.trim().replace(/^->\s*/, '');
        
        return (
          <div 
            key={i} 
            className="flex items-center space-x-2 group animate-in slide-in-from-left duration-500"
            style={{ marginLeft: `${indentLevel * 0.75}rem`, transitionDelay: `${i * 80}ms` }}
          >
            {indentLevel > 0 && (
              <svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            )}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-[10px] md:text-[12px] font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md hover:bg-white dark:hover:bg-slate-800">
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onSelectTopic, 
  onRefineConcept, 
  onHarvestConcept,
  isDarkMode 
}) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleCopy = async () => {
    try {
      const cleanContent = message.content
        .replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '');
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error('Copy failed: ', err); }
  };

  const handleToggleSpeech = async () => {
    if (isSpeaking) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = prepareSpeechText(message.content);
    if (!textToSpeak) return;

    setIsSpeaking(true);
    try {
      const base64Audio = await getGeminiTTS(textToSpeak);
      if (!base64Audio) {
        setIsSpeaking(false);
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => { setIsSpeaking(false); audioSourceRef.current = null; };
      audioSourceRef.current = source;
      source.start(0);
    } catch (err) {
      console.error('Gemini TTS failed:', err);
      setIsSpeaking(false);
    }
  };

  const extractTopics = (content: string) => {
    const match = content.match(/DEEP_LEARNING_TOPICS\s*(.*)/i);
    return match && match[1] ? match[1].split(',').map(t => t.trim()) : [];
  };

  const topics = isAssistant ? extractTopics(message.content) : [];
  const mainContent = sanitizeText(message.content);

  const renderContent = (text: string) => {
    const sections = text.split(/(1\.\sTHE\sCORE\sPRINCIPLE|2\.\sMENTAL\sMODEL\s\(ANALOGY\)|3\.\sTHE\sDIRECT\sANSWER|4\.\sCONCEPT\sMAP)/g);
    
    let isMapSection = false;

    return sections.map((part, i) => {
      const trimmed = part.trim();
      if (!trimmed) return null;

      // Handle Headers
      if (trimmed.match(/^[1-4]\.\s[A-Z\s()]+/)) {
        isMapSection = trimmed.includes('CONCEPT MAP');
        return (
          <div key={i} className="mt-6 mb-4 flex items-center space-x-2 group/header">
            <span className="flex-shrink-0 h-5 w-5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              {trimmed.charAt(0)}
            </span>
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest group-hover/header:text-indigo-500 transition-colors">
              {trimmed.substring(3)}
            </h4>
            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800/50"></div>
          </div>
        );
      }

      // Special rendering for Concept Map content
      if (isMapSection) {
        return <SimpleFlow key={i} text={trimmed} />;
      }

      // Regular Text
      return (
        <div key={i} className="whitespace-pre-wrap leading-relaxed mb-4 last:mb-0 text-[12px] md:text-[13.5px] font-medium text-slate-700 dark:text-slate-300">
          {trimmed}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-8 md:mb-12 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[95%] md:max-w-[88%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transform transition-transform hover:rotate-6 mt-1 ${isAssistant ? 'bg-indigo-600 mr-3 md:mr-4 shadow-indigo-500/20' : 'bg-slate-700 ml-3 md:ml-4 shadow-slate-500/10'}`}>
          {isAssistant ? (
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          ) : <span className="text-white text-[8px] md:text-[10px] font-bold uppercase tracking-tighter">User</span>}
        </div>
        
        <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
          <div className={`relative px-5 py-6 md:px-10 md:py-10 rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl md:shadow-2xl border transition-all duration-300 ${isAssistant ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-tl-none' : 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'}`}>
            <div className="max-w-none">
              {message.attachment && <div className="mb-6"><img src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`} className="max-w-full rounded-xl md:rounded-[2rem] shadow-xl border border-white dark:border-slate-800" alt="Context" /></div>}
              {renderContent(mainContent)}
            </div>

            {isAssistant && (
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/50 space-y-6">
                {topics.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-indigo-500"></div>
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-display">Deep Learning Nodes</span>
                    </div>
                    <nav className="flex flex-wrap gap-2 md:gap-4">
                      {topics.map((topic, i) => (
                        <button 
                          key={i} 
                          onClick={() => onSelectTopic?.(topic)}
                          className="relative group/node px-3 py-2 md:px-5 md:py-3 rounded-lg md:rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all active:scale-95"
                        >
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-indigo-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span className="text-[9px] md:text-[11px] font-black text-slate-600 dark:text-slate-300 group-hover/node:text-indigo-600 dark:group-hover/node:text-indigo-400 uppercase transition-colors">{topic}</span>
                          </div>
                        </button>
                      ))}
                    </nav>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex space-x-2">
                    <button onClick={() => onRefineConcept?.('First Principles')} className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded-lg font-display uppercase tracking-widest">
                      Logic
                    </button>
                    <button onClick={() => onRefineConcept?.('Analogies')} className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded-lg font-display uppercase tracking-widest">
                      Analogy
                    </button>
                  </div>

                  <div className="flex items-center space-x-4 ml-auto sm:ml-0">
                    <button onClick={() => onHarvestConcept?.(mainContent)} className="p-1.5 text-slate-300 hover:text-amber-500 transition-all">
                      <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </button>
                    <button onClick={handleToggleSpeech} className={`p-1.5 rounded-lg transition-all ${isSpeaking ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-500'}`}>
                      <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                    <button onClick={handleCopy} className="text-[9px] font-black text-slate-300 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <time className="text-[8px] font-black text-slate-400 mt-2 font-display uppercase tracking-widest opacity-60">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;