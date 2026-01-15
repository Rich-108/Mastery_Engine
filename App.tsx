
import React, { useState, useRef, useEffect } from 'react';
import { Message, FileData, GlossaryItem, SavedSession } from './types';
import { getGeminiResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import Glossary from './components/Glossary';
import ConfirmationModal from './components/ConfirmationModal';
import LandingPage from './components/LandingPage';
import LiveAudioSession from './components/LiveAudioSession';
import { jsPDF } from 'jspdf';

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Welcome to Mastery Engine. I am your Conceptual Architect. Ask any question, and I will first deconstruct the underlying principle before providing an answer.",
  timestamp: new Date(),
};

const STORAGE_KEY = 'mastery_engine_chat_session'; 
const GLOSSARY_KEY = 'mastery_engine_glossary';
const ENTRY_KEY = 'mastery_engine_entered';

const App: React.FC = () => {
  const [hasEntered, setHasEntered] = useState(() => localStorage.getItem(ENTRY_KEY) === 'true');
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'error'>('online');
  
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
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportButtonRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastFinalTranscriptRef = useRef<string>('');

  const handleEnter = () => {
    setHasEntered(true);
    localStorage.setItem(ENTRY_KEY, 'true');
  };

  const handleExport = (type: 'pdf' | 'word' | 'txt' | 'json') => {
    const filename = `mastery_export_${new Date().toISOString().slice(0,10)}`;
    
    switch(type) {
      case 'txt': {
        const content = messages.map(m => `[${m.timestamp.toLocaleString()}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        break;
      }
      case 'pdf': {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Mastery Engine - Conceptual Archive", 10, 20);
        let cursorY = 40;
        messages.forEach((m) => {
          const lines = doc.splitTextToSize(`${m.role.toUpperCase()}: ${m.content}`, 180);
          doc.text(lines, 10, cursorY);
          cursorY += (lines.length * 7) + 5;
          if (cursorY > 270) { doc.addPage(); cursorY = 20; }
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

  const startVoiceTranscription = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) setInput(prev => (prev + ' ' + finalTranscript).trim());
    };
    recognition.onerror = () => stopVoiceTranscription();
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceTranscription = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsRecording(false);
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
    if (isDarkMode) root.classList.add('dark'); else root.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const sendMessage = async (text: string, file?: FileData | null, lens?: string) => {
    if ((!text.trim() && !file && !lens) || isLoading) return;
    if (isRecording) stopVoiceTranscription();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: lens ? `Focus Analysis Lens: ${lens}` : text || "Reference Context Uploaded",
      timestamp: new Date(),
      attachment: file || undefined
    };

    const historySnapshot = messages
      .filter(m => m.id !== 'welcome')
      .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const responseText = await getGeminiResponse(
        lens ? `${text} (Pivot through ${lens})` : (text || "Describe the attached context."), 
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
      console.error("Mastery Engine Synthesis Error:", err);
      setSyncStatus('error');
      
      let diagnostic = err.message || "Unknown neural interference.";
      let advice = "Please verify your API key and network connection.";

      if (err.message === "MISSING_API_KEY") {
        diagnostic = "API Key not found in environment.";
        advice = "Ensure 'API_KEY' is set in Render Dashboard and trigger a manual 'Clear Cache & Deploy'.";
      } else if (err.status === 403 || err.status === 401) {
        diagnostic = "Access Denied (Invalid Key).";
        advice = "The key you provided was rejected by Google. Double check at ai.google.dev.";
      } else if (err.message?.includes('Timeout')) {
        diagnostic = "Neural Gateway Timeout.";
        advice = "The server took too long to respond. Try a shorter query.";
      }
        
      setMessages(prev => [...prev, { 
        id: Date.now().toString() + "-err", 
        role: 'assistant', 
        content: `DIAGNOSTIC ERROR: ${diagnostic}\n\nRECOVERY STEP: ${advice}`, 
        timestamp: new Date() 
      }]);
    } finally { 
      setIsLoading(false); 
    }
  };

  if (!hasEntered) return <LandingPage onEnter={handleEnter} isDarkMode={isDarkMode} />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-3 md:px-10 py-2.5 md:py-5 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center space-x-2">
          <div className="bg-indigo-600 p-1.5 md:p-2 rounded-lg md:rounded-xl flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <svg className="h-4 w-4 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="hidden xs:flex flex-col">
            <h1 className="text-xs md:text-xl font-bold text-slate-900 dark:text-slate-100 font-display">Mastery Engine</h1>
            <div className="flex items-center space-x-1">
              <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'online' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Neural Bridge: {syncStatus === 'online' ? 'Synchronized' : syncStatus === 'error' ? 'Sync Error' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 md:space-x-3">
          <button onClick={() => setIsConfirmClearOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-rose-600" title="Clear Thread"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          <button onClick={() => setIsGlossaryOpen(true)} className="p-1.5 md:p-2 text-slate-400 hover:text-amber-500" title="Glossary Library"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 md:p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] md:text-xs transition-transform active:scale-90">{isDarkMode ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-20 custom-scrollbar">
        <div className="max-w-5xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onSelectTopic={(t) => sendMessage(`Deconstruct the concept of: ${t}`)} onRefineConcept={(lens) => sendMessage('', null, lens)} onHarvestConcept={handleHarvestConcept} isDarkMode={isDarkMode} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-8 md:mb-12">
              <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] px-5 md:px-8 py-3 md:py-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center space-x-3 md:space-x-4">
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

      <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border-t border-slate-200 dark:border-slate-800 p-4 sm:p-8 md:p-12 z-40">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input, selectedFile); }} className="flex items-center space-x-2 md:space-x-6">
            <div className="relative flex-1 group">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder={isRecording ? "Listening to inquiry..." : "Enter subject for conceptual deconstruction..."} 
                className={`w-full border rounded-[1.5rem] md:rounded-[2rem] px-4 md:px-8 py-3 md:py-4.5 pr-20 md:pr-28 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-100 shadow-2xl border-slate-200 dark:border-slate-700 text-[11px] md:text-[15px] font-medium transition-all
                  ${isRecording ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600 ring-4 ring-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800'}
                `} 
                disabled={isLoading}
              />
              <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 md:p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Reference Image"><svg className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
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
              disabled={(!input.trim() && !selectedFile) || isLoading} 
              className="flex items-center justify-center h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-[1.5rem] text-white shadow-2xl active:scale-95 disabled:opacity-50 transition-all bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
            >
              <svg className="h-6 w-6 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </form>
        </div>
      </footer>

      <Glossary items={glossary} onRemove={(id) => setGlossary(prev => { const upd = prev.filter(i => i.id !== id); localStorage.setItem(GLOSSARY_KEY, JSON.stringify(upd)); return upd; })} onAdd={(term, sub, def) => { const item = { id: Date.now().toString(), term, subject: sub, definition: def, timestamp: new Date() }; setGlossary(prev => { const upd = [item, ...prev]; localStorage.setItem(GLOSSARY_KEY, JSON.stringify(upd)); return upd; }); }} isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} isDarkMode={isDarkMode} />
      <ConfirmationModal isOpen={isConfirmClearOpen} onClose={() => setIsConfirmClearOpen(false)} onConfirm={handleClearHistory} title="Reset Deconstruction" message="This will clear the current architectural thread. All derived logic will be lost from view." confirmLabel="Confirm Reset" isDarkMode={isDarkMode} />
    </div>
  );
};

export default App;
