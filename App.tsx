
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, FileData, GlossaryItem, SavedSession } from './types';
import { getGeminiResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import Glossary from './components/Glossary';
import ConfirmationModal from './components/ConfirmationModal';
import LandingPage from './components/LandingPage';
import LiveAudioSession from './components/LiveAudioSession';
import TutorialOverlay from './components/TutorialOverlay';
import { jsPDF } from 'jspdf';

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Welcome to Mastery Engine. I am your Conceptual Architect. Ask any question, and I will first deconstruct the underlying principle before providing an answer.",
  timestamp: new Date(),
};

const SYSTEM_INSTRUCTION = `You are Mastery Engine, a world-class conceptual architect and live mentor. 
Your goal is to help users master any subject by deconstructing it into first principles.
When speaking:
1. Be concise but deep.
2. Focus on the 'why' before the 'what'.
3. Use physical analogies to explain abstract concepts.
4. Guide the user through a hierarchy of logic.
5. Keep the tone professional, encouraging, and highly intellectual.`;

const STORAGE_KEY = 'mastery_engine_chat_session'; 
const GLOSSARY_KEY = 'mastery_engine_glossary';
const ENTRY_KEY = 'mastery_engine_entered';
const TUTORIAL_KEY = 'mastery_engine_tutorial_seen';

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(() => localStorage.getItem(ENTRY_KEY) === 'true');
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'error'>('online');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  
  const [isApiKeyValid, setIsApiKeyValid] = useState(() => {
    const key = process.env.API_KEY;
    return !!key && key !== "undefined" && key !== "";
  });

  useEffect(() => {
    if (!isApiKeyValid) setSyncStatus('offline');
  }, [isApiKeyValid]);
  
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
        return JSON.parse(saved).map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }));
      } catch (e) { return []; }
    }
    return [];
  });

  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  
  const [input, setInput] = useState('');
  const [interimInput, setInterimInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportButtonRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isStoppingRef = useRef(false);

  const handleEnter = () => {
    setHasEntered(true);
    localStorage.setItem(ENTRY_KEY, 'true');
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      setIsTutorialOpen(true);
    }
  };

  const stopVoiceInput = useCallback(() => {
    isStoppingRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech recognition stop error:", e);
      } finally {
        recognitionRef.current = null;
      }
    }
    setIsListening(false);
    setInterimInput('');
  }, []);

  const startVoiceInput = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("System: Browser Unsupported");
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setVoiceError("System: Mic Denied");
      return;
    }

    if (recognitionRef.current) stopVoiceInput();
    isStoppingRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      let finalBatch = '';
      let interimBatch = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalBatch += transcript;
        } else {
          interimBatch += transcript;
        }
      }

      if (finalBatch) {
        setInput(prev => {
          const trimmedPrev = prev.trim();
          return trimmedPrev ? `${trimmedPrev} ${finalBatch.trim()}` : finalBatch.trim();
        });
        setInterimInput('');
      } else {
        setInterimInput(interimBatch);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      setVoiceError(`System: ${event.error}`);
      stopVoiceInput();
    };

    recognition.onend = () => {
      if (!isStoppingRef.current && isListening) {
        try {
          recognition.start();
        } catch (e) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
        setInterimInput('');
        recognitionRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setVoiceError("System: Start Failed");
      setIsListening(false);
    }
  }, [stopVoiceInput, isListening]);

  const toggleVoiceInput = () => {
    if (isListening) stopVoiceInput();
    else startVoiceInput();
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (voiceError) {
      const timer = setTimeout(() => setVoiceError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [voiceError]);

  const handleExport = (type: 'pdf' | 'word' | 'txt' | 'json') => {
    const filename = `mastery_archive_${new Date().toISOString().slice(0,10)}`;
    switch(type) {
      case 'txt': {
        const content = messages.map(m => `[${m.timestamp.toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
      case 'json': {
        const content = JSON.stringify(messages, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
      case 'word': {
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>Mastery Archive</title><style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20pt; }
            .msg { margin-bottom: 25pt; border-bottom: 1px solid #eee; padding-bottom: 15pt; }
            .role { font-weight: bold; color: #4f46e5; text-transform: uppercase; font-size: 10pt; margin-bottom: 5pt; }
            .time { color: #999; font-weight: normal; font-size: 8pt; margin-left: 10pt; }
            .content { font-size: 11pt; line-height: 1.6; color: #333; }
            h1 { color: #1e1b4b; border-bottom: 2px solid #4f46e5; padding-bottom: 10pt; }
          </style></head><body><h1>Mastery Engine: Conceptual Archive</h1><p>Generated on: ${new Date().toLocaleString()}</p>`;
        const footer = `</body></html>`;
        const content = messages.map(m => `
          <div class="msg">
            <div class="role">${m.role} <span class="time">${m.timestamp.toLocaleString()}</span></div>
            <div class="content">${m.content.replace(/\n/g, '<br/>')}</div>
          </div>
        `).join('');
        const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.doc`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        break;
      }
      case 'pdf': {
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(79, 70, 229);
        doc.text("MASTERY ENGINE", 15, 20);
        doc.setFontSize(10); doc.setTextColor(150);
        doc.text(`CONCEPTUAL ARCHIVE | ${new Date().toLocaleString()}`, 15, 28);
        doc.setDrawColor(79, 70, 229); doc.line(15, 32, 195, 32);
        let cursorY = 45;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const maxLineWidth = pageWidth - margin * 2;
        messages.forEach((m) => {
          if (cursorY > 270) { doc.addPage(); cursorY = 20; }
          doc.setFont("helvetica", "bold"); doc.setFontSize(9);
          doc.setTextColor(m.role === 'assistant' ? 79 : 50, m.role === 'assistant' ? 70 : 50, m.role === 'assistant' ? 229 : 50);
          doc.text(`${m.role.toUpperCase()} [${m.timestamp.toLocaleTimeString()}]`, margin, cursorY);
          cursorY += 6;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40);
          const lines = doc.splitTextToSize(m.content, maxLineWidth);
          lines.forEach((line: string) => {
            if (cursorY > 280) { doc.addPage(); cursorY = 20; }
            doc.text(line, margin, cursorY); cursorY += 5.5;
          });
          cursorY += 12;
        });
        doc.save(`${filename}.pdf`);
        break;
      }
    }
    setIsExportMenuOpen(false);
  };

  const handleHarvestConcept = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const newItem: GlossaryItem = {
      id: Date.now().toString(),
      term: lines[0]?.slice(0, 50) || 'New Concept',
      subject: "Harvested",
      definition: lines.slice(1, 4).join(' ') || content,
      timestamp: new Date(),
    };
    setGlossary(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem(GLOSSARY_KEY, JSON.stringify(updated));
      return updated;
    });
    setIsGlossaryOpen(true);
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (!hasEntered) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages, hasEntered]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const sendMessage = async (text: string, file?: FileData | null, lens?: string) => {
    const combinedInput = (text || interimInput).trim();
    if ((!combinedInput && !file && !lens) || isLoading) return;
    
    if (isListening) stopVoiceInput();
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: lens ? `Focus Analysis Lens: ${lens}` : combinedInput || "Reference Context Uploaded",
      timestamp: new Date(),
      attachment: file || undefined
    };

    const historySnapshot = messages
      .filter(m => m.id !== 'welcome')
      .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setInterimInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const responseText = await getGeminiResponse(
        lens ? `${combinedInput} (Pivot through ${lens})` : (combinedInput || "Describe the attached context."), 
        historySnapshot, 
        file || undefined
      );
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString() + "-ai", 
        role: 'assistant', 
        content: responseText, 
        timestamp: new Date() 
      }]);
      setSyncStatus('online');
    } catch (err: any) { 
      setSyncStatus('error');
      setMessages(prev => [...prev, { 
        id: Date.now().toString() + "-err", 
        role: 'assistant', 
        content: `Error: ${err.message || "Neural synchronization failed."}`, 
        timestamp: new Date() 
      }]);
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleTutorialClose = () => {
    setIsTutorialOpen(false);
    localStorage.setItem(TUTORIAL_KEY, 'true');
  };

  if (!hasEntered) return <LandingPage onEnter={handleEnter} isDarkMode={isDarkMode} />;

  const displayInputValue = (input + (interimInput ? ' ' + interimInput : '')).trim();

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-3 md:px-10 py-2.5 md:py-5 flex items-center justify-between shadow-sm z-30 transition-colors duration-300">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-1.5 md:p-2 rounded-lg md:rounded-xl flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <svg className="h-4 w-4 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="hidden xs:flex flex-col">
            <h1 className="text-xs md:text-xl font-bold text-slate-900 dark:text-slate-100 font-display transition-colors">Mastery Engine</h1>
            <div className="flex items-center space-x-1">
              <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'online' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 transition-colors">
                Neural Bridge: {syncStatus === 'online' ? 'Synchronized' : syncStatus === 'error' ? 'Sync Error' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 md:space-x-3">
          <button 
            onClick={() => setIsLiveSessionOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all group active:scale-95"
          >
            <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse group-hover:bg-white"></div>
            <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
          </button>

          <div className="relative" ref={exportButtonRef}>
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
              className={`p-1.5 md:p-2 rounded-lg transition-all ${isExportMenuOpen ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-indigo-600'}`}
              title="Export Archive"
            >
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-3 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 animate-in slide-in-from-top-2 duration-300 z-[100] ring-4 ring-indigo-500/5 transition-colors">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Synthesis Export</p>
                </div>
                <button onClick={() => handleExport('pdf')} className="w-full text-left px-3 py-2.5 text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-3 animate-pulse"></span> Export as PDF
                </button>
                <button onClick={() => handleExport('word')} className="w-full text-left px-3 py-2.5 text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-3"></span> Export as Word (.doc)
                </button>
                <button onClick={() => handleExport('txt')} className="w-full text-left px-3 py-2.5 text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-3"></span> Export as Transcript
                </button>
                <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2.5 text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-3"></span> Export as JSON Data
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setIsConfirmClearOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Clear Thread"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          <button onClick={() => setIsGlossaryOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-amber-500 transition-colors" title="Glossary Library"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></button>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 transition-colors"></div>

          <button onClick={() => setIsTutorialOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Help/Tutorial">
            <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="group relative p-1.5 md:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90"
            title={isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
          >
            {isDarkMode ? (
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-20 custom-scrollbar transition-colors">
        <div className="max-w-5xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSelectTopic={(t) => sendMessage(`Deconstruct the concept of: ${t}`)} onRefineConcept={(lens) => sendMessage('', null, lens)} onHarvestConcept={handleHarvestConcept} isDarkMode={isDarkMode} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-8 md:mb-12">
              <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] px-5 md:px-8 py-3 md:py-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center space-x-3 md:space-x-4 transition-all">
                <div className="flex space-x-1">
                  <div className="h-1.5 md:h-2 w-1.5 md:w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-1.5 md:h-2 w-1.5 md:w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-1.5 md:h-2 w-1.5 md:w-2 bg-indigo-500 rounded-full animate-bounce"></div>
                </div>
                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-indigo-500 font-display">Architecting Logic...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border-t border-slate-200 dark:border-slate-800 p-4 sm:p-8 md:p-12 z-40 transition-colors">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input, selectedFile); }} className="flex items-center space-x-2 md:space-x-6">
            <div className="relative flex-1 group">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[1.6rem] md:rounded-[2.1rem] blur opacity-20 group-focus-within:opacity-40 transition-opacity duration-500 ${isListening ? 'opacity-50 animate-pulse' : ''}`}></div>
              <input 
                type="text" 
                value={displayInputValue} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={isListening ? "Listening to neural patterns..." : (voiceError || "Enter subject for conceptual deconstruction...")} 
                className={`relative w-full border rounded-[1.5rem] md:rounded-[2rem] px-4 md:px-8 py-3 md:py-4.5 pr-20 md:pr-36 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-100 shadow-2xl border-slate-200 dark:border-slate-700 text-[11px] md:text-[15px] font-medium transition-all duration-300 ${isListening ? 'bg-indigo-50/20 dark:bg-indigo-900/10 border-indigo-400 dark:border-indigo-600' : voiceError ? 'bg-rose-50/20 dark:bg-rose-950/10 border-rose-200 dark:border-rose-800' : 'bg-slate-50 dark:bg-slate-800'}`}
                disabled={isLoading}
              />
              <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                {isListening && (
                  <div className="flex items-center space-x-0.5 px-2 md:px-3 h-4">
                    <div className="w-0.5 md:w-1 bg-indigo-500 rounded-full animate-voice-wave [animation-delay:-0.3s]"></div>
                    <div className="w-0.5 md:w-1 bg-indigo-500 rounded-full animate-voice-wave [animation-delay:-0.15s]"></div>
                    <div className="w-0.5 md:w-1 bg-indigo-500 rounded-full animate-voice-wave"></div>
                  </div>
                )}
                <button 
                  type="button" 
                  onClick={toggleVoiceInput} 
                  className={`p-1.5 md:p-2 rounded-full transition-all ${isListening ? 'text-white bg-indigo-600 ring-4 ring-indigo-500/30 shadow-lg' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                  title={isListening ? "End Voice Input" : "Begin Voice Input"}
                >
                  <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 md:p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Reference Image">
                  <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => setSelectedFile({ data: (reader.result as string).split(',')[1], mimeType: file.type });
                  reader.readAsDataURL(file);
                }} />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={(!displayInputValue && !selectedFile) || isLoading} 
              className="flex items-center justify-center h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-[1.5rem] text-white shadow-2xl active:scale-95 disabled:opacity-50 transition-all bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
            >
              <svg className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
        </div>
      </footer>

      <Glossary items={glossary} onRemove={(id) => setGlossary(prev => { const upd = prev.filter(i => i.id !== id); localStorage.setItem(GLOSSARY_KEY, JSON.stringify(upd)); return upd; })} onAdd={(term, sub, def) => { const item = { id: Date.now().toString(), term, subject: sub, definition: def, timestamp: new Date() }; setGlossary(prev => { const upd = [item, ...prev]; localStorage.setItem(GLOSSARY_KEY, JSON.stringify(upd)); return upd; }); }} isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} isDarkMode={isDarkMode} />
      <ConfirmationModal isOpen={isConfirmClearOpen} onClose={() => setIsConfirmClearOpen(false)} onConfirm={handleClearHistory} title="Reset Deconstruction" message="This will clear the current architectural thread. All derived logic will be lost from view." confirmLabel="Confirm Reset" isDarkMode={isDarkMode} />
      <LiveAudioSession isOpen={isLiveSessionOpen} onClose={() => setIsLiveSessionOpen(false)} isDarkMode={isDarkMode} systemInstruction={SYSTEM_INSTRUCTION} />
      <TutorialOverlay isOpen={isTutorialOpen} onClose={handleTutorialClose} isDarkMode={isDarkMode} />
    </div>
  );
};

export default App;
