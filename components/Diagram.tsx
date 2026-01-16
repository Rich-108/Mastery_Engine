
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
    // 1. Basic cleanup of code blocks
    let processed = raw.replace(/```mermaid\n?|```/g, '').trim();
    
    // 2. Fix common AI arrow mistakes
    processed = processed
      .replace(/--\s*>/g, '-->')
      .replace(/-\s*->/g, '-->')
      .replace(/=\s*=>/g, '==>');

    // 3. Normalize the header (case-insensitive detection, standard lowercase output)
    let lines = processed.split('\n');
    
    // Check if the first non-empty line has a valid diagram type
    const headerRegex = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i;
    let headerIndex = lines.findIndex(l => l.trim().match(headerRegex));

    if (headerIndex !== -1) {
      // Force the diagram type keyword to lowercase to avoid UnknownDiagramError
      lines[headerIndex] = lines[headerIndex].replace(headerRegex, (match) => match.toLowerCase());
    } else {
      // If no valid header is found, prepend a default one
      lines.unshift('flowchart TD');
    }

    // 4. Sanitize node labels while respecting nested syntax
    const sanitizedLines = lines.map(line => {
      let l = line.trim();
      // Skip headers, empty lines, and comments
      if (!l || l.match(headerRegex) || l.startsWith('%%')) return l;
      
      /**
       * This regex looks for patterns like: nodeID[Label Content] or nodeID((Label Content))
       * It ensures labels are wrapped in quotes ONLY if they aren't already,
       * preventing syntax errors from special characters like parentheses.
       */
      return l.replace(/([a-zA-Z0-9_\-]+)\s*([\[\(\{]{1,2})(.*?)([\]\)\}]{1,2})/g, (match, id, open, label, close) => {
        let cleanLabel = label.trim();
        // If label contains quotes or is already quoted, don't wrap it
        if (cleanLabel && !cleanLabel.startsWith('"') && !cleanLabel.endsWith('"')) {
          // Escape existing internal quotes and wrap in double quotes
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
