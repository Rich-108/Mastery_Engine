
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
  const [transcript, setTranscript] = useState<string[]>([]);
  const [volume, setVolume] = useState(0);
  
  const audioContextRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const currentTranscriptionRef = useRef({ input: '', output: '' });

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const startSession = async () => {
      try {
        setStatus('connecting');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Setup Audio Contexts
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
              
              const source = inputCtx.createMediaStreamSource(stream);
              const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              // Simple volume analyzer
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
                
                sessionPromise.then((session) => {
                  if (active) session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(analyzer);
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!active) return;

              // Handle Transcriptions
              if (message.serverContent?.outputTranscription) {
                currentTranscriptionRef.current.output += message.serverContent.outputTranscription.text;
              } else if (message.serverContent?.inputTranscription) {
                // Note: Even if we don't set inputAudioTranscription in config, 
                // some versions/models might still send it. We keep this to catch it.
                currentTranscriptionRef.current.input += message.serverContent.inputTranscription.text;
              }

              if (message.serverContent?.turnComplete) {
                const outText = currentTranscriptionRef.current.output;
                const inText = currentTranscriptionRef.current.input;
                if (inText || outText) {
                  setTranscript(prev => [...prev.slice(-10), inText ? `You: ${inText}` : '', outText ? `Engine: ${outText}` : ''].filter(Boolean));
                }
                currentTranscriptionRef.current = { input: '', output: '' };
                setStatus('listening');
              }

              // Handle Audio Output
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setStatus('speaking');
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
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
              console.error('Live session error:', e);
              setStatus('error');
            },
            onclose: () => {
              if (active) setStatus('connecting');
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            outputAudioTranscription: {},
            // inputAudioTranscription: {}, // REMOVED: Not supported in the current Live API spec
          },
        });

        sessionRef.current = await sessionPromise;
      } catch (err) {
        console.error('Failed to start live session:', err);
        setStatus('error');
      }
    };

    startSession();

    return () => {
      active = false;
      if (sessionRef.current) sessionRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
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
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in duration-300">
        <div className="p-10 text-center">
          <div className="flex justify-between items-start mb-10">
            <div className="text-left">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Live Mastery</h2>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1">Real-time Neural Bridge</p>
            </div>
            <button onClick={onClose} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-12 py-6">
            <div className="relative flex items-center justify-center">
              {/* Visualizer Rings */}
              <div className={`absolute h-48 w-48 rounded-full border-4 border-indigo-500/20 transition-transform duration-100 ${status === 'listening' ? 'scale-110' : 'scale-100'}`} style={{ transform: `scale(${1 + volume / 100})` }}></div>
              <div className={`absolute h-40 w-40 rounded-full border-2 border-indigo-500/40 transition-transform duration-150 ${status === 'listening' ? 'scale-105' : 'scale-100'}`} style={{ transform: `scale(${1 + volume / 150})` }}></div>
              
              {/* Core Pulse */}
              <div className={`h-32 w-32 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                status === 'speaking' ? 'bg-indigo-600 scale-110' : 
                status === 'error' ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-800'
              }`}>
                {status === 'connecting' ? (
                  <div className="h-8 w-8 border-4 border-slate-400 border-t-indigo-600 rounded-full animate-spin"></div>
                ) : status === 'error' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ) : (
                  <div className={`flex space-x-1 items-end h-10 ${status === 'listening' && volume > 10 ? 'animate-pulse' : ''}`}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-1.5 bg-white rounded-full transition-all duration-75" style={{ 
                        height: status === 'speaking' ? '100%' : `${20 + (volume * (i + 1) / 4)}%`,
                        opacity: 0.8 + (i * 0.05)
                      }}></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <p className={`text-lg font-bold tracking-tight mb-1 transition-colors ${status === 'speaking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {status === 'connecting' ? 'Establishing Connection...' : 
                 status === 'listening' ? 'I\'m listening...' : 
                 status === 'speaking' ? 'Engine is responding...' : 
                 'Bridge Interrupted'}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                {status === 'error' ? 'Check Microphone permissions' : 'Voice Interaction Active'}
              </p>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] p-6 max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800">
            {transcript.length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center py-4">Real-time transcripts will appear here</p>
            ) : (
              <div className="space-y-3">
                {transcript.map((line, i) => (
                  <p key={i} className={`text-xs leading-relaxed ${line.startsWith('You:') ? 'text-slate-500 font-bold' : 'text-indigo-600 dark:text-indigo-400 font-black'}`}>
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
          
          <button 
            onClick={onClose}
            className="mt-10 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAudioSession;
