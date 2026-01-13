import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mermaid from 'mermaid';

interface DiagramProps {
  chart: string;
  isDarkMode?: boolean;
}

type DiagramTheme = 'indiglo' | 'blueprint' | 'emerald' | 'rose';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  fontFamily: '"Inter", sans-serif',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'monotoneY',
    nodeSpacing: 60,
    rankSpacing: 80,
    padding: 30
  }
});

const Diagram: React.FC<DiagramProps> = ({ chart, isDarkMode: appDarkMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<{title: string, detail: string, original?: string} | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isRendering, setIsRendering] = useState(true);
  
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [activeTheme, setActiveTheme] = useState<DiagramTheme>('indiglo');
  const [localDarkMode, setLocalDarkMode] = useState<boolean | null>(null);

  const effectiveDarkMode = useMemo(() => {
    if (localDarkMode !== null) return localDarkMode;
    return appDarkMode ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [appDarkMode, localDarkMode]);

  const complexity = useMemo(() => {
    const nodeCount = (chart.match(/[\[\(\{]/g) || []).length;
    if (nodeCount > 15) return 'high';
    if (nodeCount > 7) return 'medium';
    return 'low';
  }, [chart]);

  const handleReset = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isZoomed) return;
    e.preventDefault();
    const scaleFactor = 0.1;
    const delta = e.deltaY > 0 ? -scaleFactor : scaleFactor;
    const newScale = Math.min(Math.max(transform.scale + delta, 0.2), 5);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isZoomed) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const sanitizeMermaid = (raw: string): string => {
    // Phase 1: Aggressive global fixes for broken arrows and syntax symbols
    let processed = raw
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/-{1,}\s*-->/g, ' --> ')  // Fixes "A -- --> B" or "A --- --> B"
      .replace(/={1,}\s*==>/g, ' ==> ')  // Fixes "A == ==> B"
      .replace(/-\.\s*->/g, ' -.-> ')    // Fixes "A -. -> B"
      .trim();

    let lines = processed.split('\n');

    // Ensure chart header exists
    if (lines.length > 0 && !lines[0].match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i)) {
      lines.unshift('flowchart TD');
    }

    // Phase 2: Per-line fixes for labels and IDs
    const finalLines = lines.map(line => {
      let l = line.trim();
      if (!l || l.startsWith('%%')) return l;

      // Fix broken node patterns: ID[Label]ID or ID(Label)ID
      // This regex cleans up trailing junk and ensures quoted labels
      l = l.replace(/([a-zA-Z0-9_.\-]+)\s*([\[\(\{]{1,2})(.*?)([\]\)\}]{1,2})([a-zA-Z0-9_.\-]*)/g, (match, id, open, label, close, accidentalSuffix) => {
        const cleanId = id.trim().replace(/[^a-zA-Z0-9]/g, '_');
        let processedLabel = label.trim();
        
        // Ensure the label is wrapped in quotes and doesn't contain breaking characters
        if (!processedLabel.startsWith('"') || !processedLabel.endsWith('"')) {
            processedLabel = `"${processedLabel.replace(/[\"\'\|]/g, ' ').replace(/[\[\]\(\)]/g, ' ').trim()}"`;
        } else {
            // Already quoted, but clean inside
            const inner = processedLabel.slice(1, -1);
            processedLabel = `"${inner.replace(/[\"\'\|]/g, ' ').replace(/[\[\]\(\)]/g, ' ').trim()}"`;
        }
        
        return `${cleanId}${open}${processedLabel}${close}`;
      });

      // Handle simple unlinked arrows like "A > B"
      l = l.replace(/([a-zA-Z0-9_.\-]+)\s*>\s*([a-zA-Z0-9_.\-]+)/g, '$1 --> $2');

      // Ensure edge labels between pipes are quoted correctly
      l = l.replace(/(-->|==>|-\.>|-\|)\|([^|]+)\|/g, (match, arrow, label) => {
        if (label.trim().startsWith('"') && label.trim().endsWith('"')) return match;
        const cleanLabel = label.replace(/[\"\'\|\[\]\(\)]/g, ' ').trim();
        return `${arrow}|"${cleanLabel}"|`;
      });

      return l;
    });

    return finalLines.join('\n');
  };

  const getThemeVariables = (theme: DiagramTheme, dark: boolean) => {
    const palette = {
      indiglo: { primary: '#6366f1', secondary: '#4338ca', accent: '#818cf8', bg: dark ? '#0f172a' : '#ffffff' },
      blueprint: { primary: '#0ea5e9', secondary: '#0369a1', accent: '#7dd3fc', bg: dark ? '#082f49' : '#ffffff' },
      emerald: { primary: '#10b981', secondary: '#047857', accent: '#6ee7b7', bg: dark ? '#064e3b' : '#ffffff' },
      rose: { primary: '#f43f5e', secondary: '#be123c', accent: '#fda4af', bg: dark ? '#4c0519' : '#ffffff' }
    };
    
    const colors = palette[theme];
    
    return dark ? {
      primaryColor: '#1e293b', 
      primaryTextColor: '#f8fafc',
      primaryBorderColor: colors.primary, 
      lineColor: colors.primary,
      secondaryColor: colors.bg,
      tertiaryColor: '#1e293b',
      mainBkg: colors.bg,
      nodeBorder: colors.secondary,
      clusterBkg: colors.bg,
      clusterBorder: colors.accent,
      titleColor: '#f8fafc',
      edgeLabelBackground: colors.bg,
      fontFamily: '"Inter", sans-serif',
      fontSize: complexity === 'high' ? '10px' : '11px'
    } : {
      primaryColor: '#ffffff',
      primaryTextColor: '#0f172a',
      primaryBorderColor: colors.primary,
      lineColor: colors.secondary,
      secondaryColor: '#f8fafc',
      tertiaryColor: '#f1f5f9',
      mainBkg: '#ffffff',
      nodeBorder: colors.secondary,
      clusterBkg: '#f8fafc',
      clusterBorder: '#cbd5e1',
      titleColor: '#0f172a',
      edgeLabelBackground: '#ffffff',
      fontFamily: '"Inter", sans-serif',
      fontSize: complexity === 'high' ? '10px' : '11px'
    };
  };

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
        const themeType = effectiveDarkMode ? 'dark' : 'neutral';
        const themeVariables = getThemeVariables(activeTheme, effectiveDarkMode);

        mermaid.initialize({
          theme: themeType,
          themeVariables,
          flowchart: { 
            htmlLabels: true, 
            curve: complexity === 'high' ? 'basis' : 'monotoneY',
            rankSpacing: complexity === 'high' ? 120 : 80,
            nodeSpacing: complexity === 'high' ? 100 : 60,
            padding: 40
          }
        });

        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 11)}`;
        const cleanChart = sanitizeMermaid(chart);

        const { svg: renderedSvg } = await mermaid.render(id, cleanChart);
        
        if (active) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (active) {
          setError({
            title: 'Visual Logic Conflict',
            detail: 'The architectural map encountered a syntax error during synthesis.',
            original: err.message
          });
          setIsRendering(false);
        }
      }
    };

    renderDiagram();

    return () => { active = false; };
  }, [chart, effectiveDarkMode, activeTheme, complexity]);

  const themes: {id: DiagramTheme, color: string, label: string}[] = [
    { id: 'indiglo', color: 'bg-indigo-500', label: 'Indiglo' },
    { id: 'blueprint', color: 'bg-sky-500', label: 'Blueprint' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Emerald' },
    { id: 'rose', color: 'bg-rose-500', label: 'Rose' }
  ];

  if (error) {
    return (
      <div className="my-8 p-6 border-2 border-dashed border-rose-200 dark:border-rose-900/30 rounded-3xl bg-rose-50/20 dark:bg-rose-950/20">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 text-rose-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-600 dark:text-rose-400 mb-2">{error.title}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-1">{error.detail}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-12 relative group" role="region" aria-label="Conceptual Map">
      <div className={`absolute -inset-4 rounded-[4rem] blur-3xl opacity-10 transition-all duration-1000 ${effectiveDarkMode ? 'bg-indigo-500' : 'bg-indigo-200'} ${complexity === 'high' ? 'opacity-20 scale-105' : ''}`}></div>
      
      <div 
        ref={wrapperRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative z-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl transition-all duration-700 overflow-hidden flex flex-col items-center justify-center
          ${effectiveDarkMode ? 'bg-slate-900' : 'bg-white'}
          ${isZoomed ? 'fixed inset-4 md:inset-12 z-[150] bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl ring-8 ring-indigo-500/20 rounded-[4rem] cursor-move' : 'p-8 md:p-12 min-h-[350px]'}`}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(${effectiveDarkMode ? '#ffffff' : '#000000'} 1px, transparent 0)`, backgroundSize: '24px 24px' }}></div>

        {!isRendering && (
          <div className={`absolute top-6 left-6 right-6 z-20 flex items-center justify-between transition-opacity duration-500 ${isZoomed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <div className="flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
              {themes.map(t => (
                <button 
                  key={t.id}
                  onClick={(e) => { e.stopPropagation(); setActiveTheme(t.id); }}
                  className={`h-6 w-6 rounded-lg transition-all active:scale-90 ${t.color} ${activeTheme === t.id ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 scale-110 shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                />
              ))}
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); setLocalDarkMode(prev => prev === null ? !effectiveDarkMode : !prev); }}
                className={`p-1.5 rounded-lg transition-all ${effectiveDarkMode ? 'text-amber-400 bg-slate-700' : 'text-slate-400 bg-slate-100'}`}
              >
                {effectiveDarkMode ? '☀️' : '🌙'}
              </button>
              {isZoomed && (
                <>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    className="px-3 py-1 text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700"
                  >
                    Reset View
                  </button>
                </>
              )}
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); handleReset(); }}
              className="p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isZoomed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                )}
              </svg>
            </button>
          </div>
        )}

        {isRendering ? (
          <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative h-24 w-24">
              <div className="absolute inset-0 border-4 border-dashed border-indigo-500/20 rounded-full animate-spin-slow"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 bg-indigo-600 rounded-xl shadow-2xl flex items-center justify-center animate-pulse">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              </div>
            </div>
            <p className="text-[12px] font-black text-indigo-600 uppercase tracking-[0.4em] animate-pulse">Synthesizing Logic</p>
          </div>
        ) : (
          <div 
            ref={containerRef} 
            className={`mermaid-container flex justify-center w-full transition-transform duration-300 ${isZoomed ? 'h-full flex items-center' : 'max-h-[600px] overflow-hidden'}`}
            style={isZoomed ? {
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'center'
            } : {}}
          >
            <div 
              className="mermaid w-full flex justify-center select-none pointer-events-none"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
        
        {!isRendering && (
          <div className="mt-8 flex items-center justify-center space-x-6 w-full px-8 pointer-events-none">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] select-none text-center">
              {isZoomed ? 'Scroll to Zoom • Drag to Pan' : 'Conceptual Analysis Bridge'}
            </p>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
          </div>
        )}
      </div>

      {isZoomed && (
        <div 
          className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-2xl animate-in fade-in duration-500"
          onClick={() => setIsZoomed(false)}
        />
      )}
      
      <style>{`
        .mermaid svg {
          max-width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        .mermaid .node rect, .mermaid .node circle, .mermaid .node polygon, .mermaid .node path, .mermaid .node ellipse {
          stroke-width: 2.5px !important;
        }
        .mermaid .edgePath path {
          stroke-width: 2px !important;
          opacity: 0.8;
        }
        .mermaid .edgeLabel text {
          font-size: ${complexity === 'high' ? '10px' : '11px'} !important;
          font-weight: 600 !important;
          font-family: 'Inter', sans-serif !important;
        }
        .mermaid .node text {
          font-family: 'Inter', sans-serif !important;
          font-weight: 700 !important;
        }
        ${effectiveDarkMode ? `
          .mermaid .node text { fill: #f8fafc !important; }
          .mermaid .edgeLabel text { fill: #94a3b8 !important; }
          .mermaid .node rect, .mermaid .node circle { filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); }
        ` : `
          .mermaid .node text { fill: #0f172a !important; }
          .mermaid .edgeLabel text { fill: #64748b !important; }
        `}
      `}</style>
    </div>
  );
};

export default Diagram;