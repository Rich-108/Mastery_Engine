
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface DiagramProps {
  chart: string;
  isDarkMode?: boolean;
}

// Initialize mermaid once outside the component
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  }
});

const Diagram: React.FC<DiagramProps> = ({ chart, isDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<{title: string, detail: string} | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let active = true;

    const renderDiagram = async () => {
      if (!chart.trim()) {
        if (active) setIsRendering(false);
        return;
      }
      
      if (active) setIsRendering(true);
      if (active) setError(null);

      try {
        // Update theme variables based on current mode
        const theme = isDarkMode ? 'dark' : 'base';
        const themeVariables = isDarkMode ? {
          primaryColor: '#818cf8',
          primaryTextColor: '#f8fafc',
          primaryBorderColor: '#4f46e5',
          lineColor: '#94a3b8',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
        } : {
          primaryColor: '#6366f1',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#4338ca',
          lineColor: '#64748b',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#f8fafc',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
        };

        mermaid.initialize({
          theme,
          themeVariables
        });

        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 11)}`;
        
        // Sanitize chart code: remove potential LLM artifacts
        let cleanChart = chart
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        
        // Ensure flowchart direction is specified if missing
        if (!cleanChart.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i)) {
          cleanChart = `graph TD\n${cleanChart}`;
        }

        // Render to SVG string
        const { svg: renderedSvg } = await mermaid.render(id, cleanChart);
        
        if (active) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (active) {
          setError({
            title: 'Mapping Failed',
            detail: 'The engine encountered a syntax error in the conceptual map. The text logic remains available above.'
          });
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [chart, isDarkMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsZoomed(!isZoomed);
    } else if (e.key === 'Escape' && isZoomed) {
      setIsZoomed(false);
    }
  };

  if (error) {
    return (
      <div role="status" className="my-6 p-4 border border-dashed border-red-200 dark:border-red-900/30 rounded-2xl bg-red-50/30 dark:bg-red-950/20 text-slate-600 dark:text-slate-400">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5 flex-shrink-0 text-red-500 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">{error.title}</p>
            <p className="text-xs leading-relaxed opacity-80">{error.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 relative group" role="region" aria-label="Conceptual Flowchart">
      <div 
        tabIndex={0}
        role="button"
        aria-label={isZoomed ? "Close expanded conceptual map" : "Click to expand conceptual map"}
        aria-expanded={isZoomed}
        onKeyDown={handleKeyDown}
        className={`bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-inner transition-all duration-500 cursor-zoom-in focus:outline-none focus:ring-4 focus:ring-indigo-500/50 min-h-[200px] flex flex-col items-center justify-center
          ${isZoomed ? 'fixed inset-4 z-[100] p-10 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-md ring-4 ring-indigo-500/20' : 'p-4 md:p-6'}`}
        onClick={() => !isRendering && setIsZoomed(!isZoomed)}
      >
        {isRendering ? (
          <div className="flex flex-col items-center space-y-6 py-12 w-full max-w-sm">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl shimmer-bg ring-4 ring-indigo-500/5"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 shimmer-bg rounded-lg animate-pulse delay-75"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 shimmer-bg rounded-lg animate-pulse delay-150"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 shimmer-bg rounded-lg animate-pulse delay-200"></div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 shimmer-bg rounded-lg animate-pulse delay-300"></div>
              <div className="absolute inset-0 border-2 border-dashed border-indigo-500/10 rounded-full animate-spin-slow"></div>
            </div>
            
            <div className="text-center space-y-3">
              <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] animate-pulse">
                Synthesizing Bridge
              </p>
            </div>
          </div>
        ) : (
          <div 
            ref={containerRef} 
            aria-hidden="true"
            className={`mermaid flex justify-center w-full transition-transform duration-300 overflow-hidden ${isZoomed ? 'scale-110' : 'max-h-[400px]'}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        
        {!isRendering && (
          <div className="mt-4 flex items-center justify-center space-x-3 w-full">
            <div className="h-px flex-1 max-w-[40px] bg-slate-200 dark:bg-slate-800" aria-hidden="true"></div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none whitespace-nowrap">
              {isZoomed ? 'Esc to minimize' : 'Conceptual Analysis Bridge'}
            </span>
            <div className="h-px flex-1 max-w-[40px] bg-slate-200 dark:bg-slate-800" aria-hidden="true"></div>
          </div>
        )}

        {(!isZoomed && !isRendering) && (
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        )}
      </div>

      {isZoomed && (
        <div 
          className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setIsZoomed(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Diagram;
