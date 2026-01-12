
import React, { useState, useRef } from 'react';
import { Message } from '../types';
import Diagram from './Diagram';
import { prepareSpeechText, getGeminiTTS } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audio';

interface ChatMessageProps {
  message: Message;
  onSelectTopic?: (topic: string) => void;
  onRefineConcept?: (lens: string) => void;
  isDarkMode?: boolean;
}

const sanitizeText = (text: string) => {
  return text.replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '').trim();
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSelectTopic, onRefineConcept, isDarkMode }) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleCopy = async () => {
    try {
      const cleanContent = message.content
        .replace(/```mermaid[\s\S]*?```/g, '[Diagram]')
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
    const parts = text.split(/(```mermaid[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```mermaid')) {
        const chart = part.replace(/```mermaid/g, '').replace(/```/g, '').trim();
        return <Diagram key={i} chart={chart} isDarkMode={isDarkMode} />;
      }
      return <div key={i} className="whitespace-pre-wrap leading-relaxed mb-4 last:mb-0">{part}</div>;
    });
  };

  return (
    <div className={`flex w-full mb-8 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-10 w-10 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-lg transition-all mt-1 ${isAssistant ? 'bg-indigo-600 mr-4' : 'bg-slate-500 ml-4'}`}>
          {isAssistant ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          ) : 'U'}
        </div>
        <div className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
          <div className={`relative px-6 py-5 rounded-[2rem] text-[15px] shadow-sm border transition-all duration-300 ${isAssistant ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-800 rounded-tl-none' : 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'}`}>
            <div className="max-w-none">
              {message.attachment && <div className="mb-4"><img src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`} className="max-w-full rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 max-h-80 object-contain" alt="User upload" /></div>}
              {renderContent(mainContent)}
            </div>

            {isAssistant && (
              <div className="mt-6 pt-5 border-t border-slate-50 dark:border-slate-800 space-y-4">
                {topics.length > 0 && (
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Deep Learning Nodes</span>
                    <nav className="flex flex-wrap gap-2">
                      {topics.map((topic, i) => <button key={i} onClick={() => onSelectTopic?.(topic)} className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-indigo-600 hover:text-white transition-all">{topic}</button>)}
                    </nav>
                  </div>
                )}
                
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Refine Conceptual Lens</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onRefineConcept?.('First Principles')} className="px-3 py-1.5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center">
                      <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      Logic
                    </button>
                    <button onClick={() => onRefineConcept?.('Analogies')} className="px-3 py-1.5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center">
                      <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Analogy
                    </button>
                    <button onClick={() => onRefineConcept?.('Visual Mapping')} className="px-3 py-1.5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center">
                      <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                      Bridge
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button onClick={() => setFeedback(feedback === 'up' ? null : 'up')} className={`p-1 transition-colors ${feedback === 'up' ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-400'}`}><svg className="h-4 w-4" fill={feedback === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path d="M14 10h4.708C19.743 10 20.5 10.842 20.5 11.854c0 .487-.194.948-.533 1.287l-6.039 6.039a2.103 2.103 0 01-1.487.616H8.5c-1.105 0-2-.895-2-2v-7c0-.53.21-1.04.586-1.414l4.828-4.828a2 2 0 012.828 0c.2.2.343.435.414.69l.844 3.376c.07.28.07.56.07.842V10z" /></svg></button>
                    <button onClick={handleToggleSpeech} disabled={isSpeaking && !audioSourceRef.current} className={`p-1 transition-colors ${isSpeaking ? 'text-indigo-600 animate-pulse' : 'text-slate-300 hover:text-indigo-500'} disabled:opacity-20`} title="Listen to explanation">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </button>
                  </div>
                  <button onClick={handleCopy} className="text-[10px] font-black uppercase text-slate-300 hover:text-indigo-600 tracking-tighter">{copied ? 'Copied' : 'Copy Logic'}</button>
                </div>
              </div>
            )}
          </div>
          <time className="text-[9px] text-slate-400 mt-2 uppercase tracking-[0.2em] font-black">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
