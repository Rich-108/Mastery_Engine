
import React, { useState, useRef } from 'react';
import { Message } from '../types';
import { prepareSpeechText, getGeminiTTS } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';
import Diagram from './Diagram';

interface ChatMessageProps {
  message: Message;
  onSelectTopic?: (topic: string) => void;
  onRefineConcept?: (lens: string) => void;
  onHarvestConcept?: (content: string) => void;
  isDarkMode?: boolean;
}

const sanitizeText = (text: string) => {
  return text.replace(/EXPANSION_NODES[\s\S]*?$/g, '').replace(/[*#]/g, '').trim();
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
      const cleanContent = sanitizeText(message.content);
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
    const match = content.match(/EXPANSION_NODES\s*:\s*(.*)/i) || content.match(/EXPANSION_NODES\s*(.*)/i);
    if (!match || !match[1]) return [];
    
    const raw = match[1].replace(/[\[\]]/g, '').trim();
    return raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
  };

  const topics = isAssistant ? extractTopics(message.content) : [];
  const mainContent = sanitizeText(message.content);

  const renderContent = (text: string) => {
    const sections = text.split(/(1\.\sTHE\sCORE\sPRINCIPLE|2\.\sMENTAL\sMODEL\s\(ANALOGY\)|3\.\sTHE\sDIRECT\sANSWER|4\.\sCONCEPT\sMAP)/g);
    
    let isMapSection = false;
    let isCoreSection = false;

    return sections.map((part, i) => {
      const trimmed = part.trim();
      if (!trimmed) return null;

      if (trimmed.match(/^[1-4]\.\s[A-Z\s()]+/)) {
        isMapSection = trimmed.includes('CONCEPT MAP');
        isCoreSection = trimmed.includes('CORE PRINCIPLE');
        return (
          <div key={i} className="mt-5 md:mt-10 mb-3 md:mb-6 flex items-center space-x-2 md:space-x-4 group/header">
            <span className={`flex-shrink-0 h-5 w-5 md:h-8 md:w-8 rounded-lg md:rounded-2xl text-[8px] md:text-[12px] font-black flex items-center justify-center border shadow-sm transition-transform group-hover/header:rotate-6 ${
              isCoreSection 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20' 
                : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'
            }`}>
              {trimmed.charAt(0)}
            </span>
            <h4 className={`text-[8px] md:text-[12px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-colors ${
              isCoreSection 
                ? 'text-indigo-600 dark:text-indigo-400' 
                : 'text-slate-400 dark:text-slate-500 group-hover/header:text-indigo-500'
            }`}>
              {trimmed.substring(3)}
            </h4>
            <div className={`flex-1 h-[1px] ${isCoreSection ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800/50'}`}></div>
          </div>
        );
      }

      if (isMapSection) {
        const mermaidMatch = trimmed.match(/(graph|flowchart)\s+[\s\S]+/i);
        if (mermaidMatch) {
           return <Diagram key={i} chart={mermaidMatch[0]} isDarkMode={isDarkMode} />;
        }
        return null;
      }

      return (
        <div 
          key={i} 
          className={`whitespace-pre-wrap leading-relaxed mb-5 md:mb-8 last:mb-0 text-[11px] md:text-[16px] font-medium transition-all duration-500 ${
            isCoreSection 
              ? 'text-slate-900 dark:text-slate-100 bg-indigo-50/10 dark:bg-indigo-950/20 p-5 md:p-10 rounded-[1.5rem] md:rounded-[3.5rem] border border-indigo-100/20 dark:border-indigo-900/10 shadow-inner' 
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {trimmed}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-6 md:mb-20 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[98%] md:max-w-[94%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-8 w-8 md:h-16 md:w-16 rounded-xl md:rounded-[2rem] flex items-center justify-center shadow-2xl transform transition-transform hover:rotate-6 mt-1 ${isAssistant ? 'bg-indigo-600 mr-2 md:mr-10 shadow-indigo-500/30' : 'bg-slate-800 ml-2 md:ml-10 shadow-slate-500/10'}`}>
          {isAssistant ? (
            <svg className="w-4 h-4 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          ) : <span className="text-white text-[8px] md:text-[14px] font-black uppercase tracking-tighter">STUD</span>}
        </div>
        
        <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
          <div className={`relative px-4 py-5 md:px-14 md:py-14 rounded-[1.2rem] md:rounded-[4rem] shadow-[0_15px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.35)] border transition-all duration-300 ${isAssistant ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-tl-none' : 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'}`}>
            <div className="max-w-none">
              {message.attachment && <div className="mb-6 md:mb-10"><img src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`} className="max-w-full rounded-[1.2rem] md:rounded-[3.5rem] shadow-2xl border border-white dark:border-slate-800" alt="Reference" /></div>}
              {renderContent(mainContent)}
            </div>

            {isAssistant && (
              <div className="mt-6 md:mt-14 pt-4 md:pt-10 border-t border-slate-100 dark:border-slate-800/50 space-y-6 md:space-y-10">
                {topics.length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 md:space-x-3 mb-3 md:mb-6">
                      <div className="h-1.5 w-1.5 md:h-2.5 md:w-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span className="text-[9px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] md:tracking-[0.3em] font-display">Expansion Nodes</span>
                    </div>
                    <nav className="flex flex-wrap gap-2 md:gap-5">
                      {topics.map((topic, i) => (
                        <button 
                          key={i} 
                          onClick={() => onSelectTopic?.(topic)}
                          className="relative group/node px-3 py-2 md:px-6 md:py-5 rounded-xl md:rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all active:scale-95 hover:shadow-xl"
                        >
                          <div className="flex items-center space-x-2 md:space-x-4">
                            <div className="h-2 w-2 md:h-3 md:w-3 rounded-full border border-indigo-500/20 group-hover/node:border-indigo-500 group-hover/node:bg-indigo-500/10 transition-all"></div>
                            <span className="text-[9px] md:text-[13px] font-bold text-slate-600 dark:text-slate-200 uppercase tracking-tight">{topic}</span>
                          </div>
                        </button>
                      ))}
                    </nav>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-8">
                  <div className="flex space-x-2 md:space-x-4">
                    <button onClick={() => onRefineConcept?.('First Principles')} className="px-3 py-1.5 md:px-6 md:py-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 text-[8px] md:text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all rounded-lg md:rounded-2xl font-display uppercase tracking-widest active:scale-95 shadow-sm">
                      Deconstruct
                    </button>
                    <button onClick={() => onRefineConcept?.('Practical Application')} className="px-3 py-1.5 md:px-6 md:py-3 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[8px] md:text-[11px] font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all rounded-lg md:rounded-2xl font-display uppercase tracking-widest active:scale-95 shadow-sm">
                      Application
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 md:space-x-6 ml-auto sm:ml-0">
                    <button onClick={() => onHarvestConcept?.(mainContent)} className="p-1.5 md:p-2.5 text-slate-300 hover:text-amber-500 transition-all transform hover:scale-125" title="Archive Concept">
                      <svg className="h-4 w-4 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    </button>
                    <button onClick={handleToggleSpeech} className={`p-1.5 md:p-2.5 rounded-lg md:rounded-2xl transition-all transform hover:scale-125 ${isSpeaking ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-300 hover:text-indigo-500'}`} title="Speak">
                      <svg className="h-4 w-4 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                    <button onClick={handleCopy} className="text-[8px] md:text-[11px] font-black text-slate-300 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] md:tracking-[0.3em] px-2 md:px-4 py-1 md:py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg md:rounded-2xl border border-transparent hover:border-slate-200">
                      {copied ? 'Captured' : 'Capture'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <time className="text-[7px] md:text-[10px] font-black text-slate-300 dark:text-slate-600 mt-3 md:mt-5 font-display uppercase tracking-[0.2em] md:tracking-[0.4em] opacity-60 flex items-center">
            <svg className="w-2 md:w-3 h-2 md:h-3 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
