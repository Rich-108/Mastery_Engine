import React, { useState } from 'react';

interface LandingPageProps {
  onEnter: () => void;
  isDarkMode: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter, isDarkMode }) => {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleStart = () => {
    setIsInitializing(true);
    setTimeout(onEnter, 1200);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="max-w-xl w-full text-center">
        <div className="mb-12 relative">
          <div className="absolute inset-0 bg-indigo-600/20 blur-[100px] rounded-full"></div>
          <div className="relative inline-flex items-center justify-center bg-indigo-600 p-8 rounded-[2.5rem] shadow-2xl mb-8 transform transition-transform hover:scale-105 duration-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className={`text-5xl md:text-6xl font-black tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Mastery Engine
          </h1>
          <p className="text-indigo-600 dark:text-indigo-400 text-sm font-bold tracking-tight">
            Conceptual intelligence portal
          </p>
        </div>

        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 md:p-14 shadow-2xl transition-all duration-500 ${isInitializing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
          <div className="mb-10 text-center">
            <h2 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Guest Session</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto font-medium">
              Initialize the engine to begin your journey into conceptual mastery.
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={isInitializing}
            className={`group relative w-full overflow-hidden rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-xl transition-all hover:bg-indigo-700 active:scale-[0.98] ${isInitializing ? 'cursor-wait' : ''}`}
          >
            <span className={`relative z-10 transition-transform duration-300 ${isInitializing ? 'translate-y-12' : 'translate-y-0'}`}>
              Initialize Engine
            </span>
            {isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-600">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
            <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100"></div>
          </button>

          <div className="mt-12 flex flex-col items-center space-y-6">
            <div className="flex items-center w-full px-4">
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              <span className="px-4 text-[9px] font-bold text-slate-300 dark:text-slate-600 tracking-tight">System protocols</span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
            </div>
            
            <div className="flex items-center space-x-8">
              <div className="flex flex-col items-center opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 21a10.003 10.003 0 008.384-4.51m-2.408-3.06a3.5 3.5 0 11-8.354-5.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646" />
                </svg>
                <span className="text-[8px] font-bold tracking-tight">Encrypted</span>
              </div>
              <div className="flex flex-col items-center opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-[8px] font-bold tracking-tight">Secure</span>
              </div>
              <div className="flex flex-col items-center opacity-40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[8px] font-bold tracking-tight">Verified</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 text-[10px] text-slate-400 dark:text-slate-600 font-bold tracking-tight animate-pulse">
          Establishing neural connection...
        </p>
      </div>
    </div>
  );
};

export default LandingPage;