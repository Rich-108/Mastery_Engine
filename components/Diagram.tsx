
import React, { useEffect, useState, useMemo } from 'react';
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
    // 1. Basic cleanup of code blocks, common AI artifacts, and smart quotes
    let processed = raw
      .replace(/```mermaid\n?|```/g, '')
      .replace(/^[\d]+\.\s*/gm, '') // Remove numbered list markers at start of lines
      .replace(/[“”]/g, '"') // Normalize smart double quotes
      .replace(/[‘’]/g, "'") // Normalize smart single quotes
      .trim();
    
    // 2. Fix common AI arrow mistakes
    processed = processed
      .replace(/--\s*>/g, '-->')
      .replace(/-\s*->/g, '-->')
      .replace(/=\s*=>/g, '==>');

    // 3. Normalize the header
    let lines = processed.split('\n');
    
    const headerRegex = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i;
    let headerIndex = lines.findIndex(l => l.trim().match(headerRegex));

    if (headerIndex !== -1) {
      let header = lines[headerIndex].trim();
      // Force diagram type to lowercase
      header = header.replace(headerRegex, (match) => match.toLowerCase());
      
      // Fix invalid directions (e.g., "graph TDA" -> "flowchart TD")
      if (header.match(/^(graph|flowchart)/)) {
        if (!header.match(/\s+(TD|TB|BT|RL|LR)$/i)) {
          header = 'flowchart TD';
        }
      }
      lines[headerIndex] = header;
    } else {
      lines.unshift('flowchart TD');
    }

    // 4. Sanitize node labels and IDs
    const sanitizedLines = lines.map(line => {
      let l = line.trim();
      // Skip headers, empty lines, and comments
      if (!l || l.match(headerRegex) || l.startsWith('%%')) return l;
      
      // Fix: Remove quotes surrounding node definitions
      // Matches: "SomeID" [ or "SomeID"[ or "Some ID"[
      // We capture the ID content and the shape opener.
      l = l.replace(/"([^"]+)"\s*([\[\(\{\>])/g, (match, idContent, shapeOpen) => {
          // Sanitize ID: remove spaces, special chars that break IDs
          const cleanId = idContent.trim().replace(/\s+/g, '_').replace(/[^\w\-\.]/g, '_');
          return `${cleanId}${shapeOpen}`;
      });

      // Fix: Clean up "hanging" quotes for standalone IDs (e.g. A --> "B")
      // Handles A --> "B" or A --> "B Node"
      l = l.replace(/(^|[\s\->;])"([^"]+)"([\s\->;]|$)/g, (match, prefix, idContent, suffix) => {
         const cleanId = idContent.trim().replace(/\s+/g, '_').replace(/[^\w\-\.]/g, '_');
         return `${prefix}${cleanId}${suffix}`;
      });

      /**
       * Regex to match all Mermaid node shapes.
       * Captures: ID, Open, Content, Close.
       * Updated ID capture to include dots [a-zA-Z0-9_\-\.]
       */
      const nodeRegex = /([a-zA-Z0-9_\-\.]+)\s*(?:(\[\()(.+?)(\)\])|(\[\[)(.+?)(\]\])|(\{\{)(.+?)(\}\})|(\(\()(.+?)(\)\))|(\[\/)(.+?)(\\\])|(\[)(.+?)(\])|(\()(.+?)(\))|(\{)(.+?)(\})|(\>)(.+?)(\]))/g;

      return l.replace(nodeRegex, (match, id, ...args) => {
        // Find the matched group for open/label/close
        let open = '', label = '', close = '';
        for (let i = 0; i < args.length - 2; i += 3) {
           if (args[i]) {
             open = args[i];
             label = args[i+1];
             close = args[i+2];
             break;
           }
        }
        
        if (!label) return match;

        let cleanLabel = label.trim();
        
        // 1. Remove existing wrapping quotes if present
        if (cleanLabel.startsWith('"') && cleanLabel.endsWith('"') && cleanLabel.length >= 2) {
          cleanLabel = cleanLabel.slice(1, -1);
        }

        // 2. Escape internal double quotes to single quotes
        cleanLabel = cleanLabel.replace(/"/g, "'");

        // 3. Always re-wrap in double quotes to ensure valid Mermaid syntax
        return `${id}${open}"${cleanLabel}"${close}`;
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
        
        // Re-initialize for theme updates
        mermaid.initialize({
          startOnLoad: false,
          theme: effectiveDarkMode ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: '"Outfit", sans-serif',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 50,
            rankSpacing: 50,
            padding: 20
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

  // Fallback to raw text if rendering fails
  if (error) {
    return (
      <div className="my-6 md:my-10 relative group">
        <div className={`relative z-10 rounded-2xl border border-red-200 dark:border-red-900/30 p-6 ${effectiveDarkMode ? 'bg-red-950/10' : 'bg-red-50/50'}`}>
          <div className="flex items-center space-x-2 mb-3">
             <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500">Diagram Render Issue</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 font-medium">Using fallback text visualization:</p>
          <pre className="text-[10px] md:text-xs font-mono text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
            {chart}
          </pre>
        </div>
      </div>
    );
  }

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
