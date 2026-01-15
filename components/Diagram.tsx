
import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';

interface DiagramProps {
  chart: string;
  isDarkMode?: boolean;
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  fontFamily: '"Outfit", sans-serif',
  theme: 'neutral',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    nodeSpacing: 50,
    rankSpacing: 50,
    padding: 20
  }
});

const Diagram: React.FC<DiagramProps> = ({ chart, isDarkMode: appDarkMode }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState(true);

  const effectiveDarkMode = useMemo(() => {
    return appDarkMode ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [appDarkMode]);

  const sanitizeMermaid = (raw: string): string => {
    let processed = raw.replace(/```mermaid\n?|```/g, '').trim();
    
    processed = processed
      .replace(/--\s*>/g, '-->')
      .replace(/-\s*->/g, '-->')
      .replace(/=\s*=>/g, '==>');

    processed = processed.replace(/^(flowchart|graph)\s+(TD|LR|BT|RL)\s*([^\s\n])/i, '$1 $2\n$3');
    
    let lines = processed.split('\n');
    if (lines.length > 0 && !lines[0].match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i)) {
      lines.unshift('flowchart TD');
    }

    const sanitizedLines = lines.map(line => {
      let l = line.trim();
      if (!l || l.match(/^(graph|flowchart|sequenceDiagram)/i) || l.startsWith('%%')) return l;
      
      return l.replace(/([a-zA-Z0-9_\-]+)\s*([\[\(\{]{1,2})(.*?)([\]\)\}]{1,2})/g, (match, id, open, label, close) => {
        let cleanLabel = label.trim();
        if (cleanLabel && !cleanLabel.startsWith('"')) {
          cleanLabel = `"${cleanLabel.replace(/"/g, "'")}"`;
        }
        return `${id}${open}${cleanLabel}${close}`;
      });
    });

    return sanitizedLines.join('\n');
  };

  useEffect(() => {
    let active = true;
    const renderDiagram = async () => {
      if (!chart.trim()) return;
      setIsRendering(true);
      setError(false);
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const cleanChart = sanitizeMermaid(chart);
        
        mermaid.initialize({
          startOnLoad: false,
          theme: effectiveDarkMode ? 'dark' : 'neutral',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            padding: 15,
            nodeSpacing: 50,
            rankSpacing: 50
          }
        });

        const { svg: renderedSvg } = await mermaid.render(id, cleanChart);
        if (active) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (active) {
          setError(true);
          setIsRendering(false);
        }
      }
    };
    renderDiagram();
    return () => { active = false; };
  }, [chart, effectiveDarkMode]);

  if (error) return null;

  return (
    <div className="my-6 md:my-10 relative group">
      <div className={`relative z-10 rounded-[1.5rem] md:rounded-[4rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center justify-center p-4 md:p-14 ${effectiveDarkMode ? 'bg-slate-900/40' : 'bg-slate-50/40'} backdrop-blur-md`}>
        {isRendering ? (
          <div className="flex flex-col items-center py-8">
            <div className="h-1.5 w-16 bg-indigo-500/20 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-indigo-500 w-1/2 animate-[shimmer_1.5s_infinite]"></div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-500 animate-pulse">Architecting Logic...</p>
          </div>
        ) : (
          <div className="mermaid-container w-full max-h-[250px] md:max-h-[450px] overflow-auto flex justify-center custom-scrollbar px-2 md:px-6" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .mermaid-container svg {
          height: auto !important;
          max-width: 100% !important;
          min-width: 150px;
        }
        .mermaid-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
        }
      `}</style>
    </div>
  );
};

export default Diagram;
