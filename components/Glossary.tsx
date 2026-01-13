import React, { useState, useMemo } from 'react';
import { GlossaryItem } from '../types';

interface GlossaryProps {
  items: GlossaryItem[];
  onRemove: (id: string) => void;
  onAdd: (term: string, subject: string, definition: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

type SortOption = 'alpha' | 'recent';

const Glossary: React.FC<GlossaryProps> = ({ items, onRemove, onAdd, isOpen, onClose, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('alpha');
  const [newTerm, setNewTerm] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDef, setNewDef] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 rounded-sm px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const subjects = useMemo(() => {
    const subs = Array.from(new Set(items.map(i => i.subject).filter(Boolean)));
    return ['all', ...subs.sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const termLower = (item.term || '').toLowerCase();
      const defLower = (item.definition || '').toLowerCase();
      const subLower = (item.subject || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = 
        termLower.includes(searchLower) ||
        defLower.includes(searchLower) ||
        subLower.includes(searchLower);
      
      const matchesSubject = selectedSubject === 'all' || item.subject === selectedSubject;
      
      return matchesSearch && matchesSubject;
    });

    if (sortBy === 'alpha') {
      result.sort((a, b) => a.term.localeCompare(b.term));
    } else {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return result;
  }, [items, searchTerm, selectedSubject, sortBy]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTerm.trim() && newDef.trim()) {
      onAdd(newTerm.trim(), newSubject.trim() || 'General', newDef.trim());
      setNewTerm('');
      setNewSubject('');
      setNewDef('');
      setIsAdding(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSubject('all');
    setSortBy('alpha');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end overflow-hidden" role="none">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="glossary-title"
        className={`relative w-full sm:max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 transform translate-x-0 ${isDarkMode ? 'dark' : ''}`}
      >
        <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="glossary-title" className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Library
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-950/40 space-y-2 md:space-y-3 shadow-inner">
          <div className="relative">
            <input 
              type="text"
              autoComplete="off"
              placeholder="Search library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-[12px] md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="flex space-x-2">
            <select 
              value={selectedSubject} 
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase text-slate-500 outline-none"
            >
              {subjects.map(s => <option key={s} value={s}>{s === 'all' ? 'All Subjects' : s}</option>)}
            </select>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase text-slate-500 outline-none"
            >
              <option value="alpha">A-Z</option>
              <option value="recent">Newest</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 px-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Library Empty</p>
            </div>
          ) : (
            <div className="space-y-3 pb-6">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl hover:border-indigo-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-black text-slate-800 dark:text-slate-100 text-[12px] uppercase tracking-tight">
                        <HighlightText text={item.term} highlight={searchTerm} />
                      </h3>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <HighlightText text={item.subject} highlight={searchTerm} />
                      </span>
                    </div>
                    <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors ml-2">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    <HighlightText text={item.definition} highlight={searchTerm} />
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/30">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Mastery Neural Storage v1.5</p>
        </div>
      </div>
    </div>
  );
};

export default Glossary;