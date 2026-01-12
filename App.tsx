
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, FileData, GlossaryItem } from './types';
import { getGeminiResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import Glossary from './components/Glossary';
import TutorialOverlay from './components/TutorialOverlay';
import ConfirmationModal from './components/ConfirmationModal';
import LandingPage from './components/LandingPage';
import SavedChatsModal from './components/SavedChatsModal';
import LiveAudioSession from './components/LiveAudioSession';

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Welcome to MASTERY ENGINE. I help you master any subject by breaking it down into fundamental principles. What concept would you like to explore today?",
  timestamp: new Date(),
};

const STORAGE_KEY = 'mastery_engine_chat_history_session'; 
const SAVED_SESSIONS_KEY = 'mastery_engine_saved_sessions_list';
const MODEL_KEY = 'mastery_engine_selected_model';
const GLOSSARY_KEY = 'mastery_engine_glossary';
const TUTORIAL_KEY = 'mastery_engine_tutorial_seen';
const ENTRY_KEY = 'mastery_engine_entered';
const THINKING_KEY = 'mastery_engine_thinking_mode';

const MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex Logic' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast Analysis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Lite 2.5', desc: 'Instant Responses' },
];

export interface SavedSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
}

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(() => localStorage.getItem(ENTRY_KEY) === 'true');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(MODEL_KEY) || MODELS[0].id);
  const [isThinkingMode, setIsThinkingMode] = useState(() => localStorage.getItem(THINKING_KEY) === 'true');
  const [isModelLoading, setIsModelLoading] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) { return [INITIAL_MESSAGE]; }
    }
    return [INITIAL_MESSAGE];
  });

  const [glossary, setGlossary] = useState<GlossaryItem[]>(() => {
    const saved = localStorage.getItem(GLOSSARY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });

  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSavedChatsOpen, setIsSavedChatsOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSaveStatus, setManualSaveStatus] = useState<'idle' | 'saved' | 'no-data'>('idle');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [inputHistory, setInputHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isInternalUpdate = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>(messages);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEnter = () => {
    setHasEntered(true);
    localStorage.setItem(ENTRY_KEY, 'true');
  };

  const handleExportPDF = () => {
    setIsExportMenuOpen(false);
    window.print();
  };

  const handleExportText = () => {
    setIsExportMenuOpen(false);
    const fileName = `Mastery_Transcript_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    
    let textContent = `MASTERY ENGINE - CONCEPTUAL TRANSCRIPT\n`;
    textContent += `Generated on: ${new Date().toLocaleString()}\n`;
    textContent += `------------------------------------------\n\n`;

    messages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'ENGINE ANALYSIS' : 'USER INQUIRY';
      const cleanContent = msg.content
        .replace(/```mermaid[\s\S]*?```/g, '[Conceptual Map Diagram]')
        .replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '');
      
      textContent += `[${role} - ${msg.timestamp.toLocaleTimeString()}]\n`;
      textContent += `${cleanContent}\n\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    setIsExportMenuOpen(false);
    const fileName = `Mastery_Transcript_${new Date().toISOString().slice(0, 10)}.doc`;
    
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Mastery Engine Academic Transcript</title>
      <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.5; padding: 40pt; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 1.5pt solid #4338ca; padding-bottom: 20pt; margin-bottom: 30pt; }
        .title { color: #4338ca; font-size: 28pt; font-weight: bold; letter-spacing: 1pt; text-transform: uppercase; }
        .subtitle { font-size: 10pt; color: #64748b; font-weight: bold; margin-top: 5pt; letter-spacing: 2pt; }
        .session-info { text-align: right; font-size: 9pt; color: #64748b; margin-bottom: 40pt; }
        .entry { margin-bottom: 25pt; page-break-inside: avoid; }
        .role { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1pt; margin-bottom: 6pt; border-bottom: 0.5pt solid #e2e8f0; }
        .role-user { color: #64748b; }
        .role-engine { color: #4338ca; }
        .content { font-size: 11pt; text-align: justify; }
        .footer { margin-top: 50pt; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 0.5pt solid #e2e8f0; padding-top: 10pt; }
      </style>
      </head>
      <body>
        <div class='header'>
          <div class='title'>Mastery Engine</div>
          <div class='subtitle'>Cognitive Conceptual Transcript</div>
        </div>
        <div class='session-info'>
          Archive ID: ${Math.random().toString(36).substring(7).toUpperCase()}<br>
          Analysis Date: ${new Date().toLocaleDateString()}<br>
          Format: Academic Archive
        </div>
    `;

    messages.forEach(msg => {
      const isUser = msg.role === 'user';
      const cleanContent = msg.content
        .replace(/```mermaid[\s\S]*?```/g, '[Conceptual Map Diagram Included in Digital Session]')
        .replace(/DEEP_LEARNING_TOPICS[\s\S]*?$/g, '');
        
      htmlContent += `
        <div class='entry'>
          <div class='role ${isUser ? 'role-user' : 'role-engine'}'>${isUser ? 'Inquiry Participant' : 'Analytical Engine'} • ${msg.timestamp.toLocaleTimeString()}</div>
          <div class='content'>${cleanContent.replace(/\n/g, '<br>')}</div>
        </div>
      `;
    });

    htmlContent += `
        <div class='footer'>
          Generated by Mastery Engine Synthesis Protocol • Mastery Hub: ${glossary.length} Concepts Tracked
        </div>
      </body></html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (input !== inputHistory[historyIndex]) {
        const newHistory = inputHistory.slice(0, historyIndex + 1);
        newHistory.push(input);
        if (newHistory.length > 50) newHistory.shift();
        setInputHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input, inputHistory, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalUpdate.current = true;
      const prevValue = inputHistory[historyIndex - 1];
      setInput(prevValue);
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex, inputHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < inputHistory.length - 1) {
      isInternalUpdate.current = true;
      const nextValue = inputHistory[historyIndex + 1];
      setInput(nextValue);
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, inputHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo(); else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') handleRedo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    if (!hasEntered) return;
    messagesRef.current = messages;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    const tutorialSeen = localStorage.getItem(TUTORIAL_KEY);
    if (!tutorialSeen && messages.length === 1) {
      const timer = setTimeout(() => setIsTutorialOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [messages, hasEntered]);

  useEffect(() => { localStorage.setItem(MODEL_KEY, selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem(THINKING_KEY, isThinkingMode.toString()); }, [isThinkingMode]);
  useEffect(() => { localStorage.setItem(GLOSSARY_KEY, JSON.stringify(glossary)); }, [glossary]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true; 
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) setInput(prev => (prev.trim() + ' ' + finalTranscript).trim());
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isRecording) recognitionRef.current.stop();
    else { try { recognitionRef.current.start(); setIsRecording(true); } catch (err) { setIsRecording(false); } }
  };

  const handleClearChat = () => {
    const freshMessage = { ...INITIAL_MESSAGE, id: Date.now().toString(), timestamp: new Date() };
    setMessages([freshMessage]);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([freshMessage]));
    setInput('');
    setSelectedFile(null);
    setError(null);
    setIsLoading(false);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
    setIsModelLoading(true);
    setTimeout(() => setIsModelLoading(false), 800);
  };

  const handleSaveToLibrary = () => {
    if (messages.length <= 1) {
      setManualSaveStatus('no-data');
      setTimeout(() => setManualSaveStatus('idle'), 2000);
      return;
    }

    const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'Conceptual Exploration';
    const title = firstUserMsg.substring(0, 40) + (firstUserMsg.length > 40 ? '...' : '');

    const newSession: SavedSession = {
      id: Date.now().toString(),
      title,
      timestamp: new Date(),
      messages,
    };

    const saved = localStorage.getItem(SAVED_SESSIONS_KEY);
    let sessions: SavedSession[] = [];
    if (saved) {
      try {
        sessions = JSON.parse(saved);
      } catch (e) { sessions = []; }
    }

    sessions.unshift(newSession);
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
    
    setManualSaveStatus('saved');
    setTimeout(() => setManualSaveStatus('idle'), 3000);
  };

  const handleLoadSession = (session: SavedSession) => {
    const formattedMessages = session.messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
    setMessages(formattedMessages);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formattedMessages));
    setIsSavedChatsOpen(false);
    setError(null);
  };

  const sendMessage = async (text: string, file?: FileData | null, lens?: string) => {
    if ((!text.trim() && !file) || isLoading) return;
    if (isRecording) recognitionRef.current.stop();

    const query = lens ? `Regarding the previous concept, provide a deep analysis through the lens of: ${lens}` : text;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: lens ? `[System Pivot: ${lens}]` : text || "[Context Uploaded]",
      timestamp: new Date(),
      attachment: file || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    if (!lens) setInput('');
    setSelectedFile(null);
    setIsLoading(true);
    setError(null);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user' as 'assistant' | 'user',
          content: msg.content
        }));

      const responseText = await getGeminiResponse(
        query, 
        history, 
        file || undefined,
        isThinkingMode ? 'gemini-3-pro-preview' : selectedModel,
        isThinkingMode
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis gateway failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasEntered) return <LandingPage onEnter={handleEnter} isDarkMode={isDarkMode} />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm z-20 transition-colors no-print">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="hidden xs:block">
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">Mastery Engine</h1>
          </div>
          
          <div className="hidden sm:flex items-center ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 space-x-2">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mastery Hub</span>
              <div className="flex items-center space-x-1.5">
                <div className="flex -space-x-1">
                  {[...Array(Math.min(3, glossary.length))].map((_, i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-indigo-500 ring-1 ring-white dark:ring-slate-900"></div>
                  ))}
                  {glossary.length > 3 && <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[5px] font-bold text-slate-500">+</div>}
                </div>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{glossary.length} Concepts</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          <button onClick={() => setIsThinkingMode(!isThinkingMode)} className={`flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isThinkingMode ? 'bg-indigo-600 text-white shadow-indigo-500/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isThinkingMode ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <span className="hidden sm:inline">{isThinkingMode ? 'Neural Active' : 'Think Deep'}</span>
          </button>

          <div className="hidden lg:flex items-center space-x-2 mr-2">
            <div className={`relative flex items-center transition-opacity ${isThinkingMode ? 'opacity-30 pointer-events-none' : ''}`}>
              <select value={selectedModel} onChange={handleModelChange} className="appearance-none bg-slate-100 dark:bg-slate-800 border-none text-slate-600 dark:text-slate-300 px-4 py-1.5 pr-8 rounded-full text-[10px] font-black uppercase focus:outline-none cursor-pointer transition-all hover:bg-slate-200">
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="absolute right-3 pointer-events-none text-slate-400"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
              {isModelLoading && <div className="absolute -right-6 flex items-center justify-center"><div className="h-3.5 w-3.5 border-2 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div></div>}
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-1">
            <div className="relative" ref={exportMenuRef}>
              <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all" title="Export Archive">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
              {isExportMenuOpen && (
                <div className="absolute right-0 mt-3 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={handleExportPDF} className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-3 transition-colors">
                    <svg className="h-4 w-4 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95 1.414-1.414 4.95 4.95z"/></svg>
                    <span>Print to PDF</span>
                  </button>
                  <button onClick={handleExportWord} className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 flex items-center space-x-3 transition-colors">
                    <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-2 14.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
                    <span>Word Export</span>
                  </button>
                  <button onClick={handleExportText} className="w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 flex items-center space-x-3 transition-colors">
                    <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <span>Plain Text</span>
                  </button>
                </div>
              )}
            </div>

            <button onClick={handleSaveToLibrary} disabled={messages.length <= 1} className={`p-2 rounded-full transition-all disabled:opacity-20 ${manualSaveStatus === 'saved' ? 'text-emerald-500' : 'text-slate-500 hover:text-indigo-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            </button>
            <button onClick={() => setIsSavedChatsOpen(true)} className="p-2 rounded-full text-slate-500 hover:text-indigo-600 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
          </div>

          <button onClick={() => setIsGlossaryOpen(true)} className="p-2 rounded-full text-slate-500 hover:text-indigo-600 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all">{isDarkMode ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <main className={`flex-1 overflow-y-auto px-4 py-8 md:px-12 custom-scrollbar transition-all duration-700 ${isThinkingMode ? 'bg-indigo-50/10 dark:bg-indigo-950/10' : ''}`}>
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <ChatMessage message={msg} onSelectTopic={(t) => sendMessage(`Deep dive into: ${t}`)} onRefineConcept={(lens) => sendMessage('', null, lens)} isDarkMode={isDarkMode} />
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start mb-6 animate-pulse no-print">
              <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center mr-4 shadow-lg"><svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
              <div className={`bg-white dark:bg-slate-900 rounded-[2rem] px-8 py-5 shadow-sm border ${isThinkingMode ? 'border-indigo-400 ring-8 ring-indigo-500/5' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="flex flex-col space-y-3">
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce delay-75"></div>
                    <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
                  </div>
                  <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{isThinkingMode ? 'Probing Deep Conceptual Layers...' : 'Synthesizing Bridge...'}</p>
                </div>
              </div>
            </div>
          )}
          {error && <div className="p-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-2xl mb-8 text-xs font-bold uppercase tracking-tight no-print">{error}</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 md:p-8 transition-colors no-print">
        <div className="max-w-4xl mx-auto">
          {isRecording && (
            <div className="flex justify-center items-center space-x-1.5 mb-6 animate-in slide-in-from-bottom-2 fade-in">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-1.5 bg-indigo-600 rounded-full animate-voice-wave" style={{ animationDelay: `${i * 0.1}s` }}></div>
              ))}
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 ml-4">Engaging Thought Buffer...</span>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input, selectedFile); }} className="flex items-center space-x-4">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={isThinkingMode ? "Input highly complex conceptual inquiry..." : "Ask your conceptual question..."} 
                className={`w-full transition-all duration-500 border rounded-2xl px-6 py-4 pr-32 focus:outline-none text-slate-800 dark:text-slate-100 shadow-sm ${isThinkingMode ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-400 ring-8 ring-indigo-500/5' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`} 
                disabled={isLoading} 
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => setSelectedFile({ data: (reader.result as string).split(',')[1], mimeType: file.type });
                  reader.readAsDataURL(file);
                }} />
                <button type="button" onClick={toggleVoiceInput} className={`p-2.5 rounded-xl transition-all active:scale-90 ${isRecording ? 'text-white bg-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`} title="Neural Voice Bridge">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
              </div>
            </div>
            <button type="submit" disabled={(!input.trim() && !selectedFile) || isLoading} className={`flex items-center justify-center h-14 w-14 rounded-2xl text-white shadow-2xl active:scale-90 disabled:bg-slate-200 disabled:text-slate-400 transition-all ${isThinkingMode ? 'bg-indigo-600' : 'bg-indigo-600'}`}>
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
          {selectedFile && <div className="mt-3 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase flex items-center animate-in slide-in-from-left-2">System analyzing visual bridge • <button onClick={() => setSelectedFile(null)} className="ml-2 text-rose-500 hover:underline">Revoke</button></div>}
        </div>
      </footer>

      <Glossary items={glossary} isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} onRemove={(id) => setGlossary(prev => prev.filter(i => i.id !== id))} onAdd={(term, subject, definition) => setGlossary(prev => [...prev, { id: Date.now().toString(), term, subject, definition, timestamp: new Date() }])} isDarkMode={isDarkMode} />
      <SavedChatsModal isOpen={isSavedChatsOpen} onClose={() => setIsSavedChatsOpen(false)} onSelect={handleLoadSession} isDarkMode={isDarkMode} />
      <TutorialOverlay isOpen={isTutorialOpen} onClose={() => { setIsTutorialOpen(false); localStorage.setItem(TUTORIAL_KEY, 'true'); }} isDarkMode={isDarkMode} />
      <ConfirmationModal isOpen={isConfirmClearOpen} onClose={() => setIsConfirmClearOpen(false)} onConfirm={handleClearChat} title="Terminate Session?" message="Are you sure you want to clear the neural history? This action is permanent." confirmLabel="Wipe Session" isDarkMode={isDarkMode} />
      <LiveAudioSession isOpen={isLiveSessionOpen} onClose={() => setIsLiveSessionOpen(false)} isDarkMode={isDarkMode} systemInstruction="You are Mastery Engine, a world-class conceptual tutor. Explain everything through first principles and analogies. Keep responses concise but conceptually deep for voice interaction." />
    </div>
  );
};

export default App;
