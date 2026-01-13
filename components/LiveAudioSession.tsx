import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encode, decode, decodeAudioData } from '../utils/audio';

interface LiveAudioSessionProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  systemInstruction: string;
}

const LiveAudioSession: React.FC<LiveAudioSessionProps> = ({ isOpen, onClose, isDarkMode, systemInstruction }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [volume, setVolume] = useState(0);
  
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    let currentSession: any = null;

    const startSession = async () => {
      try {
        setStatus('connecting');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = { input: inputCtx, output: outputCtx };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              if (!active) return;
              setStatus('listening');
              
              // Only start the processor once the socket is open
              sessionPromise.then((session) => {
                currentSession = session;
                
                const source = inputCtx.createMediaStreamSource(stream);
                const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                const analyzer = inputCtx.createAnalyser();
                analyzer.fftSize = 256;
                const bufferLength = analyzer.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                const updateVolume = () => {
                  if (!active) return;
                  analyzer.getByteFrequencyData(dataArray);
                  const average = dataArray.reduce((a, b) => a + b) / bufferLength;
                  setVolume(average);
                  requestAnimationFrame(updateVolume);
                };
                updateVolume();

                scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                  if (!active || !currentSession) return;
                  
                  const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                  const l = inputData.length;
                  const int16 = new Int16Array(l);
                  for (let i = 0; i < l; i++) {
                    int16[i] = inputData[i] * 32768;
                  }
                  
                  const pcmBlob: Blob = {
                    data: encode(new Uint8Array(int16.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                  };
                  
                  try {
                    currentSession.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) {
                    console.error('Error sending audio data:', err);
                  }
                };

                source.connect(analyzer);
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputCtx.destination);
              });
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!active) return;

              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                setStatus('speaking');
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                try {
                  const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                  const source = outputCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputCtx.destination);
                  source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) {
                      setStatus('listening');
                    }
                  });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (e) {
                  console.error('Playback error:', e);
                }
              }

              if (message.serverContent?.interrupted) {
                for (const source of sourcesRef.current) {
                  try { source.stop(); } catch(e) {}
                }
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setStatus('listening');
              }
            },
            onerror: (e) => {
              console.error('Live session error event:', e);
              if (active) setStatus('error');
            },
            onclose: (e) => {
              console.log('Live session closed:', e);
              if (active) setStatus('connecting');
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
          },
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error('Critical failure initiating live session:', err);
        if (active) setStatus('error');
      }
    };

    startSession();

    return () => {
      active = false;
      currentSession = null;
      if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.input.close();
        audioContextRef.current.output.close();
      }
    };
  }, [isOpen, systemInstruction]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[250] flex items-center justify-center p-4 ${isDarkMode ? 'dark' : ''}`}>
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in duration-300">
        <div className="p-6 md:p-10 text-center">
          <div className="flex justify-between items-start mb-6 md:mb-10">
            <div className="text-left">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Live Mastery</h2>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">Neural Bridge</p>
            </div>
            <button onClick={onClose} className="p-2 md:p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-8 md:space-y-12 py-4 md:py-6">
            <div className="relative flex items-center justify-center">
              <div 
                className={`absolute h-32 w-32 md:h-48 md:w-48 rounded-full border-4 transition-all duration-300 ${status === 'error' ? 'border-rose-500/20' : 'border-indigo-500/20'}`} 
                style={{ transform: `scale(${1 + volume / 100})` }}
              ></div>
              <div className={`h-24 w-24 md:h-32 md:w-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                status === 'speaking' ? 'bg-indigo-600 scale-105' : 
                status === 'error' ? 'bg-rose-500 animate-shake' : 
                status === 'connecting' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-800'
              }`}>
                {status === 'connecting' ? (
                  <div className="h-6 w-6 border-4 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
                ) : status === 'error' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <div className={`flex space-x-1 items-end h-8 ${status === 'listening' && volume > 10 ? 'animate-pulse' : ''}`}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-1 bg-white rounded-full transition-all duration-75" style={{ 
                        height: status === 'speaking' ? '100%' : `${20 + (volume * (i + 1) / 4)}%`,
                        opacity: 0.8 + (i * 0.05)
                      }}></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-[2rem]">
              <p className={`text-sm md:text-lg font-bold tracking-tight ${status === 'error' ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
                {status === 'listening' ? 'Listening...' : 
                 status === 'speaking' ? 'Synthesizing...' : 
                 status === 'error' ? 'Connection Interrupt' : 'Connecting Bridge...'}
              </p>
              {status === 'error' && <p className="text-[10px] mt-2 text-slate-400 font-medium">Please check your network and try again.</p>}
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className={`mt-8 w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
              status === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
            }`}
          >
            {status === 'error' ? 'Dismiss' : 'Close Bridge'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAudioSession;