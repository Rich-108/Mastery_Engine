
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, FileData, GlossaryItem } from './types';
import { getGeminiResponse } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import Glossary from './components/Glossary';
import TutorialOverlay from './components/TutorialOverlay';
import ProjectInfoModal from './components/ProjectInfoModal';
import ConfirmationModal from './components/ConfirmationModal';
import LandingPage from './components/LandingPage';
import SavedChatsModal from './components/SavedChatsModal';

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your Mastery Engine. I'm ready to help you master any subject. What concept should we dive into today?",
  timestamp: new Date(),
};

const STORAGE_KEY = 'mastery_engine_chat_history_session'; 
const SAVED_SESSIONS_KEY = 'mastery_engine_saved_sessions_list';
const MODEL_KEY = 'mastery_engine_selected_model';
const GLOSSARY_KEY = 'mastery_engine_glossary';
const TUTORIAL_KEY = 'mastery_engine_tutorial_seen';
const ENTRY_KEY = 'mastery_engine_entered';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Powerful Reasoning' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', desc: 'Instant & Fast' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', desc: 'Efficiency & Balance' },
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
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

  const handleEnter = () => {
    setHasEntered(true);
    localStorage.setItem(ENTRY_KEY, 'true');
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
      recognition.continuous = false;
      recognition.interimResults = true; 
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((result: any) => result[0]).map((result: any) => result.transcript).join('');
        setInput(transcript);
        if (event.results[0].isFinal) setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

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
    const newModel = e.target.value;
    setSelectedModel(newModel);
    setIsModelLoading(true);
    setTimeout(() => setIsModelLoading(false), 800);
  };

  const handleSaveToLibrary = () => {
    if (messages.length <= 1) return;
    try {
      const savedSessionsRaw = localStorage.getItem(SAVED_SESSIONS_KEY);
      const savedSessions: SavedSession[] = savedSessionsRaw ? JSON.parse(savedSessionsRaw) : [];
      
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'New Conceptual Inquiry';
      const title = firstUserMsg.length > 40 ? firstUserMsg.substring(0, 40) + '...' : firstUserMsg;
      
      const newSession: SavedSession = {
        id: Date.now().toString(),
        title,
        timestamp: new Date(),
        messages
      };
      
      localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify([newSession, ...savedSessions]));
      setManualSaveStatus('saved');
      setTimeout(() => setManualSaveStatus('idle'), 3000);
    } catch (e) {
      setError("Failed to save session to persistent storage.");
    }
  };

  const handleLoadSession = (session: SavedSession) => {
    const restored = session.messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
    setMessages(restored);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    setIsSavedChatsOpen(false);
    setError(null);
  };

  const sendMessage = async (text: string, file?: FileData | null) => {
    if ((!text.trim() && !file) || isLoading) return;
    if (isRecording) recognitionRef.current.stop();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || (file?.mimeType.startsWith('image/') ? "[Image Attached]" : "[File Attached]"),
      timestamp: new Date(),
      attachment: file || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
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

      // getGeminiResponse now uses Groq internally
      const responseText = await getGeminiResponse(
        text || "Analyze this conceptually.", 
        history, 
        file || undefined,
        selectedModel
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API connection issue.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasEntered) return <LandingPage onEnter={handleEnter} isDarkMode={isDarkMode} />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="hidden xs:block">
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Mastery Engine</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Powered by Groq Intelligence</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="hidden lg:flex items-center space-x-2 mr-2">
            <div className="relative flex items-center">
              <select value={selectedModel} onChange={handleModelChange} className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-1.5 pr-8 rounded-full text-xs font-bold focus:outline-none cursor-pointer transition-all hover:bg-slate-100">
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="absolute right-3 pointer-events-none text-slate-400"><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
              {isModelLoading && <div className="absolute -right-6 flex items-center justify-center"><div className="h-3.5 w-3.5 border-2 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div></div>}
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-1">
             <button 
              onClick={handleSaveToLibrary} 
              disabled={messages.length <= 1}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border disabled:opacity-30 ${manualSaveStatus === 'saved' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
              title="Save current chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>{manualSaveStatus === 'saved' ? 'Saved' : 'Save'}</span>
            </button>
            <button 
              onClick={() => setIsSavedChatsOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-all"
              title="Load saved chats"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Load</span>
            </button>
          </div>

          <button onClick={() => setIsGlossaryOpen(true)} className="relative p-2 rounded-full text-slate-500 hover:text-indigo-600 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg></button>
          <button onClick={() => setIsConfirmClearOpen(true)} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-500 text-xs font-bold transition-all"><span className="hidden sm:inline">Clear</span></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-slate-500 transition-all">{isDarkMode ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-12 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => <ChatMessage key={msg.id} message={msg} onSelectTopic={(t) => sendMessage(`Deep dive: ${t}`)} isDarkMode={isDarkMode} />)}
          {isLoading && <div className="flex justify-start mb-6 animate-pulse"><div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 mr-3 flex items-center justify-center"><span className="text-[10px] font-bold text-slate-400">ME</span></div><div className="bg-white dark:bg-slate-900 rounded-2xl px-6 py-4 shadow-sm border border-slate-50 dark:border-slate-800"><div className="flex space-x-1.5"><div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-75"></div><div className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce delay-150"></div></div></div></div>}
          {error && <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 rounded-xl mb-6 text-xs font-medium">{error}</div>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 md:p-6 transition-colors">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input, selectedFile); }} className="flex items-center space-x-3">
            <div className="relative flex-1">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isRecording ? "Listening to your question..." : "Ask your conceptual question..."} className={`w-full transition-all duration-300 border rounded-xl px-5 py-3 pr-32 focus:outline-none text-slate-700 dark:text-slate-200 ${isRecording ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`} disabled={isLoading} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-0.5 sm:space-x-1">
                <button type="button" onClick={handleUndo} disabled={historyIndex === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-20"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                <button type="button" onClick={handleRedo} disabled={historyIndex >= inputHistory.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-20"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onloadend = () => setSelectedFile({ data: (reader.result as string).split(',')[1], mimeType: file.type });
                  reader.readAsDataURL(file);
                }} />
                <button type="button" onClick={() => { if(isRecording) recognitionRef.current.stop(); else { recognitionRef.current.start(); setIsRecording(true); } }} className={`p-2 rounded-lg ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-400'}`}><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
              </div>
            </div>
            <button type="submit" disabled={(!input.trim() && !selectedFile) || isLoading} className="flex items-center justify-center h-12 w-12 rounded-xl bg-indigo-600 text-white shadow-lg active:scale-95 disabled:bg-slate-100 disabled:text-slate-400"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>
          </form>
          {selectedFile && <div className="mt-2 text-[10px] font-bold text-indigo-500 uppercase flex items-center">Context Ready • <button onClick={() => setSelectedFile(null)} className="ml-1 text-red-500 hover:underline">Remove</button></div>}
        </div>
      </footer>

      <Glossary items={glossary} isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} onRemove={(id) => setGlossary(prev => prev.filter(i => i.id !== id))} onAdd={(term, definition) => setGlossary(prev => [...prev, { id: Date.now().toString(), term, definition, timestamp: new Date() }])} isDarkMode={isDarkMode} />
      <SavedChatsModal isOpen={isSavedChatsOpen} onClose={() => setIsSavedChatsOpen(false)} onSelect={handleLoadSession} isDarkMode={isDarkMode} />
      <TutorialOverlay isOpen={isTutorialOpen} onClose={() => { setIsTutorialOpen(false); localStorage.setItem(TUTORIAL_KEY, 'true'); }} isDarkMode={isDarkMode} />
      <ConfirmationModal isOpen={isConfirmClearOpen} onClose={() => setIsConfirmClearOpen(false)} onConfirm={handleClearChat} title="Clear Chat?" message="Permanently delete this session history?" confirmLabel="Clear All" isDarkMode={isDarkMode} />
    </div>
  );
};

export default App;
