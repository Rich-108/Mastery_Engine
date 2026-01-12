
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

  // High-fidelity text highlighting component for search matches
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

  // Derive unique subjects for the filter controller
  const subjects = useMemo(() => {
    const subs = Array.from(new Set(items.map(i => i.subject).filter(Boolean)));
    return ['all', ...subs.sort()];
  }, [items]);

  // Unified filtering and sorting pipeline
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const termLower = (item.term || '').toLowerCase();
      const defLower = (item.definition || '').toLowerCase();
      const subLower = (item.subject || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      // Deep scan across all fields
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
      {/* Dynamic Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sliding Library Panel */}
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="glossary-title"
        className={`relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 transform translate-x-0 ${isDarkMode ? 'dark' : ''}`}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="glossary-title" className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Mastery Library
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-tight">Conceptual Repository</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Global Search and Filter Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/40 space-y-3 shadow-inner">
          <div className="relative">
            <input 
              type="text"
              autoComplete="off"
              placeholder="Search terms, subjects, or logic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer pr-10"
              >
                {subjects.map(s => <option key={s} value={s}>{s === 'all' ? 'All Subjects' : s}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="flex-1 relative">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer pr-10"
              >
                <option value="alpha">A to Z</option>
                <option value="recent">Recently Added</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest" aria-live="polite">
              {filteredItems.length} {filteredItems.length === 1 ? 'Concept' : 'Concepts'} Found
            </p>
            {(searchTerm || selectedSubject !== 'all') && (
              <button onClick={clearFilters} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Concept Add Trigger */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center focus:ring-2 focus:ring-indigo-500 ${isAdding ? 'bg-slate-100 dark:bg-slate-800 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-2 transition-transform ${isAdding ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {isAdding ? 'Cancel Entry' : 'Manual Concept Entry'}
          </button>

          {isAdding && (
            <form onSubmit={handleAdd} className="mt-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label htmlFor="new-term" className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1">Term</label>
                  <input id="new-term" autoFocus type="text" placeholder="e.g. Entropy" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
                <div className="col-span-1">
                  <label htmlFor="new-subject" className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1">Subject</label>
                  <input id="new-subject" type="text" placeholder="e.g. Physics" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                </div>
              </div>
              <div>
                <label htmlFor="new-definition" className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1">Core Logic</label>
                <textarea id="new-definition" placeholder="Fundamental principles of this concept..." value={newDef} onChange={(e) => setNewDef(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none transition-all" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                Save to Repository
              </button>
            </form>
          )}
        </div>

        {/* Scrollable Results List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" role="list">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4 px-8" role="status">
              <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-3xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Inquiry Unmatched</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">No concepts match the current search dimensions.</p>
              </div>
              {(searchTerm || selectedSubject !== 'all') && (
                <button onClick={clearFilters} className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase underline decoration-2 underline-offset-4 hover:text-indigo-500 transition-colors">Reset Library View</button>
              )}
            </div>
          ) : (
            <div className="space-y-4 pb-8">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  role="listitem"
                  className="group bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-5 rounded-[1.5rem] hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight text-sm">
                          <HighlightText text={item.term} highlight={searchTerm} />
                        </h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border border-slate-50 dark:border-slate-800">
                          <HighlightText text={item.subject} highlight={searchTerm} />
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-1">
                        Synthesized {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <button 
                      onClick={() => onRemove(item.id)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all focus:opacity-100 focus:ring-2 focus:ring-red-500 rounded-lg"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-3 top-0 bottom-0 w-1 bg-indigo-50 dark:bg-indigo-900/10 rounded-full group-hover:bg-indigo-300 transition-colors"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      <HighlightText text={item.definition} highlight={searchTerm} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer Summary */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <p className="text-[10px] text-center font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
            Neural Storage Optimized<br/>
            <span className="opacity-60">Global search scanning terms and definitions</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Glossary;
