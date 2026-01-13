
import React, { useState, useEffect } from 'react';
import { SavedSession } from '../types';

interface SavedChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (session: SavedSession) => void;
  isDarkMode: boolean;
}

const SAVED_SESSIONS_KEY = 'mastery_engine_saved_sessions_list';

const SavedChatsModal: React.FC<SavedChatsModalProps> = ({ isOpen, onClose, onSelect, isDarkMode }) => {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(SAVED_SESSIONS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSessions(parsed.map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) })));
        } catch (e) {
          setSessions([]);
        }
      }
    }
  }, [isOpen]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(updated));
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 ${isDarkMode ? 'dark' : ''}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Library
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">Saved Conceptual Sessions</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-950/50">
          <div className="relative">
            <input 
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredSessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-sm font-bold uppercase tracking-widest">No Saved Sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map(session => (
                <div 
                  key={session.id} 
                  onClick={() => onSelect(session)}
                  className="group bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl hover:border-indigo-500 cursor-pointer transition-all shadow-sm relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{session.title}</h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black mt-1">
                        {session.timestamp.toLocaleDateString()} • {session.messages.length} messages
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(session.id, e)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Encrypted Cloud Backup Inactive</p>
        </div>
      </div>
    </div>
  );
};

export default SavedChatsModal;