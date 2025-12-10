import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Volume2, Radio, Loader2, StopCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { LessonPlan } from '../types';
import { base64ToUint8Array, arrayBufferToBase64, pcmToAudioBuffer, float32ToInt16PCM } from '../utils/audioUtils';

interface LiveTutorProps {
  currentPlan: LessonPlan | null;
  onClose: () => void;
}

const API_KEY = process.env.API_KEY || '';

const LiveTutor: React.FC<LiveTutorProps> = ({ currentPlan, onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('connecting');
  const [transcripts, setTranscripts] = useState<{role: 'user' | 'model', text: string}[]>([]);
  
  // Refs for Audio Management
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Keep track of transcripts to avoid stale closures
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  useEffect(() => {
    connectToLiveAPI();

    return () => {
      disconnect();
    };
  }, []);

  const connectToLiveAPI = async () => {
    try {
      setStatus('connecting');
      
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 }); // Output rate
      
      // Browser Autoplay Policy fix: Resume context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const context = currentPlan 
        ? `Você está dando uma aula sobre: ${currentPlan.subject}. Os módulos são: ${currentPlan.modules.map(m => m.title).join(', ')}.` 
        : "O aluno está explorando o currículo.";

      const systemInstruction = `
        Você é o Professor Nova. Estamos em uma "Aula Ao Vivo" de áudio.
        Contexto: ${context}
        
        Seu método de ensino:
        1. Explique um conceito do plano de aula de forma breve (máximo 2 frases).
        2. Faça uma pergunta direta ao aluno para verificar o entendimento.
        3. PAUSE e aguarde a resposta do aluno.
        4. Se o aluno acertar, elogie e passe para o próximo conceito.
        5. Se errar, explique novamente de forma mais simples.
        
        Fale de forma natural, encorajadora e clara. Português do Brasil.
      `;

      // 2. Connect to Live API
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {}, // Changed from { model: ... } to {} to use default/valid config
          outputAudioTranscription: {}, // Changed from { model: ... } to {} to use default/valid config
        },
        callbacks: {
          onopen: async () => {
            console.log("Session Opened");
            setIsConnected(true);
            setStatus('listening');
            await startMicrophone();
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: () => {
            console.log("Session Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setTranscripts(prev => [...prev, {role: 'model', text: "Erro de conexão. Tente reiniciar."}]);
          }
        }
      });

    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const startMicrophone = async () => {
    if (!audioContextRef.current || !sessionPromiseRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      streamRef.current = stream;

      // Create a separate context for input to ensure 16kHz if possible, or resample
      const inputContext = new AudioContext({ sampleRate: 16000 });
      const source = inputContext.createMediaStreamSource(stream);
      // Buffer size 4096 is standard for good latency/performance balance in JS
      const processor = inputContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isMicOn) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = float32ToInt16PCM(inputData);
        
        // Base64 encode
        const base64Data = arrayBufferToBase64(pcmData.buffer);

        sessionPromiseRef.current?.then(session => {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          });
        });
      };

      source.connect(processor);
      processor.connect(inputContext.destination);

      inputSourceRef.current = source;
      processorRef.current = processor;

    } catch (err) {
      console.error("Mic Error:", err);
    }
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const { serverContent } = message;
    
    // 1. Handle Audio Output
    const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && audioContextRef.current) {
        setStatus('speaking');
        const pcmBytes = base64ToUint8Array(audioData);
        const audioBuffer = await pcmToAudioBuffer(pcmBytes, audioContextRef.current);
        
        // Schedule playback
        const ctx = audioContextRef.current;
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        // Basic scheduler
        const now = ctx.currentTime;
        // If next start time is in the past, reset it to now
        if (nextStartTimeRef.current < now) {
            nextStartTimeRef.current = now;
        }
        
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        
        source.onended = () => {
             // If this was the last chunk (approximation), go back to listening
             if (ctx.currentTime >= nextStartTimeRef.current - 0.1) {
                 setStatus('listening');
             }
        };
    }

    // 2. Handle Interruptions
    if (serverContent?.interrupted) {
        console.log("Model interrupted");
        nextStartTimeRef.current = 0;
        setStatus('listening');
    }

    // 3. Handle Transcriptions
    if (serverContent?.inputTranscription) {
        const text = serverContent.inputTranscription.text;
        if (text) {
             currentInputTransRef.current += text;
        }
    }
    
    if (serverContent?.outputTranscription) {
        const text = serverContent.outputTranscription.text;
        if (text) {
            currentOutputTransRef.current += text;
        }
    }

    // Turn Complete: Commit transcripts to state
    if (serverContent?.turnComplete) {
        if (currentInputTransRef.current) {
            setTranscripts(prev => [...prev, { role: 'user', text: currentInputTransRef.current }]);
            currentInputTransRef.current = '';
        }
        if (currentOutputTransRef.current) {
            setTranscripts(prev => [...prev, { role: 'model', text: currentOutputTransRef.current }]);
            currentOutputTransRef.current = '';
        }
        setStatus('listening');
    }
  };

  const disconnect = () => {
    // Clean up tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Clean up Audio Nodes
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
        inputSourceRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
    // Close Session (Not directly exposed on promise, we just stop sending and lose ref)
    sessionPromiseRef.current = null;
    setIsConnected(false);
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 p-6 flex justify-between items-center text-white">
          <div className="flex items-center space-x-3">
            <Radio className={`w-6 h-6 ${status === 'speaking' ? 'animate-pulse' : ''}`} />
            <div>
              <h2 className="text-lg font-bold">Aula Ao Vivo</h2>
              <p className="text-xs text-rose-100 opacity-90">{isConnected ? "Conectado ao Professor Nova" : "Conectando..."}</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Visualizer / Status Area */}
        <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 min-h-[300px] relative">
           {status === 'connecting' && (
               <div className="flex flex-col items-center text-slate-400 animate-pulse">
                   <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                   <p>Estabelecendo conexão via satélite...</p>
               </div>
           )}

           {isConnected && (
               <div className="relative flex items-center justify-center">
                   {/* Ripple Effect for Speaking/Listening */}
                   <div className={`absolute w-48 h-48 rounded-full border-4 transition-all duration-500 ${
                       status === 'speaking' ? 'border-orange-400 scale-110 opacity-50' : 
                       status === 'listening' ? 'border-blue-400 scale-100 opacity-30' : 'border-slate-200 scale-90'
                   }`}></div>
                   <div className={`absolute w-32 h-32 rounded-full border-4 transition-all duration-500 delay-75 ${
                       status === 'speaking' ? 'border-orange-500 scale-110 opacity-60' : 
                       status === 'listening' ? 'border-blue-500 scale-105 opacity-40' : 'border-slate-300 scale-95'
                   }`}></div>
                   
                   {/* Central Icon */}
                   <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl z-10 transition-all duration-300 ${
                       status === 'speaking' ? 'bg-orange-500 text-white scale-110' :
                       status === 'listening' ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-500'
                   }`}>
                       {status === 'speaking' ? <Volume2 className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
                   </div>
               </div>
           )}
           
           <div className="mt-8 text-center h-12">
               <p className="text-lg font-medium text-slate-700 transition-all">
                   {status === 'speaking' ? "O Professor está falando..." : 
                    status === 'listening' ? "Ouvindo você..." : 
                    isConnected ? "Aguardando..." : ""}
               </p>
           </div>
        </div>

        {/* Live Transcripts (Last 2-3) */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 h-40 overflow-y-auto text-sm space-y-2">
            {transcripts.length === 0 && <p className="text-slate-400 text-center italic mt-4">A conversa aparecerá aqui...</p>}
            {transcripts.slice(-4).map((t, idx) => (
                <div key={idx} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <span className={`px-3 py-2 rounded-lg max-w-[90%] ${t.role === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-white border border-slate-200 text-slate-700'}`}>
                         {t.text}
                     </span>
                </div>
            ))}
        </div>

        {/* Controls */}
        <div className="bg-white p-6 border-t border-slate-200 flex justify-center items-center space-x-6">
           <button 
                onClick={toggleMic}
                className={`p-4 rounded-full transition-all shadow-md ${isMicOn ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                title={isMicOn ? "Silenciar Microfone" : "Ativar Microfone"}
            >
               {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
           </button>

           <button 
                onClick={onClose}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center transition-transform hover:scale-105"
            >
               <StopCircle className="w-5 h-5 mr-2" />
               Encerrar Aula
           </button>
        </div>
      </div>
    </div>
  );
};

export default LiveTutor;