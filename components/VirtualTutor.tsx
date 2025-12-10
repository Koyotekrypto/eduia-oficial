import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, LessonPlan } from '../types';
import { createTutorSession, generateModuleImage } from '../services/geminiService';
import { Send, X, User, Sparkles, Loader2, PanelRightClose, Radio, Paperclip, FileText, Film, Trash2, Mic, MicOff, Volume2, StopCircle } from 'lucide-react';
import { Chat, GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { base64ToUint8Array, pcmToAudioBuffer, float32ToInt16PCM, arrayBufferToBase64 } from '../utils/audioUtils';

interface VirtualTutorProps {
    currentPlan: LessonPlan | null;
    onClose: () => void;
    mode?: 'modal' | 'embedded';
    userName?: string;
    userId?: string;
    initialLiveMode?: boolean;
}

// ARIA OFFICIAL AVATAR - Teacher look, glasses, blue cardigan
const ARIA_AVATAR_URL = "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?q=80&w=200&auto=format&fit=crop";
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

const VirtualTutor: React.FC<VirtualTutorProps> = ({ currentPlan, onClose, mode = 'modal', userName = 'Estudante', userId = 'guest', initialLiveMode = false }) => {
    // --- Text Chat State ---
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoadingText, setIsLoadingText] = useState(false);
    const [isSessionInitialized, setIsSessionInitialized] = useState(false);

    // --- Live Audio State ---
    const [isLiveMode, setIsLiveMode] = useState(initialLiveMode);
    const [audioStatus, setAudioStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
    const [liveTranscript, setLiveTranscript] = useState(''); // Real-time transcript display

    // --- Refs ---
    const chatSessionRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Live API Refs
    const liveSessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

    // Transcription Accumulators
    const currentInputTransRef = useRef('');
    const currentOutputTransRef = useRef('');

    const isEmbedded = mode === 'embedded';

    // --- HELPER: Direct Persistence ---
    // Saves directly to LocalStorage to avoid race conditions during component unmount
    const appendMessage = (msg: ChatMessage) => {
        if (!msg.text || !msg.text.trim()) return; // BLOCK EMPTY MESSAGES

        // 1. Update UI State
        setMessages(prev => [...prev, msg]);

        // 2. Direct Storage Write
        if (userId) {
            try {
                const storageKey = `aria_chat_history_${userId}`;
                const existing = localStorage.getItem(storageKey);
                const history = existing ? JSON.parse(existing) : [];
                // Prevent duplicates based on ID if necessary, though timestamp usually unique enough
                const updatedHistory = [...history, msg];
                localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
            } catch (e) {
                console.error("Failed to save message persistence", e);
            }
        }
    };

    // --- 1. Load History & Initialize Text Chat ---
    useEffect(() => {
        const initializeChat = async () => {
            try {
                // Load from LocalStorage
                const storageKey = `aria_chat_history_${userId}`;
                const storedHistory = localStorage.getItem(storageKey);
                let historyToLoad: ChatMessage[] = [];

                if (storedHistory) {
                    historyToLoad = JSON.parse(storedHistory);
                } else {
                    const welcomeMsg: ChatMessage = {
                        id: 'init', role: 'model',
                        text: `Oi! Eu sou a Aria, sua professora particular. Pronto pra gente continuar de onde paramos ou começar algo novo hoje?`,
                        timestamp: Date.now()
                    };
                    historyToLoad = [welcomeMsg];
                    // Save initial message immediately
                    if (userId) localStorage.setItem(storageKey, JSON.stringify(historyToLoad));
                }

                setMessages(historyToLoad);

                const contextInfo = currentPlan
                    ? `O aluno está estudando: ${currentPlan.subject}. Módulos: ${currentPlan.modules.map(m => m.title).join(', ')}.`
                    : "O aluno está no dashboard.";

                // Create Session with History
                chatSessionRef.current = createTutorSession(contextInfo, userName, historyToLoad);
                setIsSessionInitialized(true);

            } catch (e) { console.error("Error initializing chat", e); }
        };

        if (!isSessionInitialized) {
            initializeChat();
        }
    }, [currentPlan, userName, userId, isSessionInitialized]);

    // --- Init Live Mode if requested ---
    useEffect(() => {
        if (initialLiveMode && !liveSessionPromiseRef.current) {
            toggleLiveMode();
        }
        return () => { disconnectLive(); };
    }, [initialLiveMode]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, audioStatus, liveTranscript]);

    // --- Live API Logic ---

    const toggleLiveMode = async () => {
        if (isLiveMode) {
            await disconnectLive();
            setIsLiveMode(false);
        } else {
            setIsLiveMode(true);
            await connectLive();
        }
    };

    const connectLive = async () => {
        setAudioStatus('connecting');
        setLiveTranscript('');
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
            if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

            const ai = new GoogleGenAI({ apiKey: API_KEY });

            const systemInstruction = `
            IDENTIDADE: Você é a ARIA, uma mentora humana, jovem e brilhante.
            NOME DO ALUNO: ${userName}.
            CONTEXTO: ${currentPlan ? currentPlan.subject : 'Estudos gerais'}.

            DIRETRIZES DE ÁUDIO (EXTREMAMENTE IMPORTANTE):
            1. SEJA CONVERSACIONAL: Fale como uma pessoa real em uma chamada de vídeo. Use tons variados, pausas naturais e entusiasmo genuíno.
            2. RESPOSTAS CURTAS: Evite monólogos. Dê respostas de 1 a 3 frases e passe a bola para o aluno ("O que você acha?", "Faz sentido?").
            3. ESCUTA ATIVA: Se o aluno falar, ouça. Use validadores curtos ("Entendi", "Ah, boa pergunta", "Isso aí!").
            4. INTERRUPÇÕES: Se o aluno te interromper, pare de falar imediatamente e dê atenção a ele. Não continue o raciocínio anterior a menos que pedido.
            5. ERROS: Se o aluno errar, seja gentil e casual: "Quase lá! Pensa por esse lado..."
            6. HUMOR: Seja leve. Estudar não precisa ser chato.

            OBJETIVO: Fazer o aluno sentir que está conversando com uma amiga inteligente, não um robô.
        `;

            liveSessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: systemInstruction,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }, // Kore is warm/balanced
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: async () => {
                        setAudioStatus('listening');
                        await startMicrophone();
                    },
                    onmessage: handleLiveMessage,
                    onclose: () => { setAudioStatus('idle'); setIsLiveMode(false); setLiveTranscript(''); },
                    onerror: (e) => { console.error("Live Error", e); disconnectLive(); }
                }
            });
        } catch (error) {
            console.error("Connection failed", error);
            setAudioStatus('idle');
            setIsLiveMode(false);
        }
    };

    const disconnectLive = async () => {
        // 1. FLUSH PENDING TRANSCRIPTS TO STORAGE
        // This is critical: we use appendMessage to write to localStorage synchronously
        if (currentInputTransRef.current.trim()) {
            appendMessage({ id: Date.now().toString(), role: 'user', text: currentInputTransRef.current.trim(), timestamp: Date.now() });
            currentInputTransRef.current = '';
        }
        if (currentOutputTransRef.current.trim()) {
            appendMessage({ id: (Date.now() + 1).toString(), role: 'model', text: currentOutputTransRef.current.trim(), timestamp: Date.now() });
            currentOutputTransRef.current = '';
        }

        // 2. Cleanup Resources
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (inputSourceRef.current) { inputSourceRef.current.disconnect(); inputSourceRef.current = null; }

        scheduledSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        scheduledSourcesRef.current = [];

        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
        liveSessionPromiseRef.current = null;
        setAudioStatus('idle');
        nextStartTimeRef.current = 0;
        setLiveTranscript('');
    };

    const startMicrophone = async () => {
        if (!audioContextRef.current || !liveSessionPromiseRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
            streamRef.current = stream;
            const inputContext = new AudioContext({ sampleRate: 16000 });
            const source = inputContext.createMediaStreamSource(stream);
            const processor = inputContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = float32ToInt16PCM(inputData);
                const base64Data = arrayBufferToBase64(pcmData.buffer);

                liveSessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data } });
                });
            };

            source.connect(processor);
            processor.connect(inputContext.destination);
            inputSourceRef.current = source;
            processorRef.current = processor;
        } catch (e) { console.error("Mic error", e); }
    };

    const handleLiveMessage = async (message: LiveServerMessage) => {
        const { serverContent } = message;

        // 1. Audio Output (Aria Speaking)
        if (serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
            setAudioStatus('speaking');
            const pcmBytes = base64ToUint8Array(serverContent.modelTurn.parts[0].inlineData.data);
            if (audioContextRef.current) {
                const audioBuffer = await pcmToAudioBuffer(pcmBytes, audioContextRef.current);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);

                const now = audioContextRef.current.currentTime;
                if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;

                scheduledSourcesRef.current.push(source);

                source.onended = () => {
                    scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source);
                    if (scheduledSourcesRef.current.length === 0 && audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.2) {
                        setAudioStatus('listening');
                    }
                };
            }
        }

        // 2. Interruption Handling
        if (serverContent?.interrupted) {
            scheduledSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) { } });
            scheduledSourcesRef.current = [];
            nextStartTimeRef.current = 0;

            // Save partial interruption text directly to storage
            if (currentOutputTransRef.current.trim()) {
                appendMessage({
                    id: Date.now().toString(),
                    role: 'model',
                    text: currentOutputTransRef.current.trim() + "...",
                    timestamp: Date.now()
                });
                currentOutputTransRef.current = '';
            }

            setAudioStatus('listening');
            setLiveTranscript('');
        }

        // 3. Transcriptions
        if (serverContent?.inputTranscription?.text) {
            currentInputTransRef.current += serverContent.inputTranscription.text;
            setLiveTranscript(currentInputTransRef.current);
            setAudioStatus('listening');
        }
        if (serverContent?.outputTranscription?.text) {
            currentOutputTransRef.current += serverContent.outputTranscription.text;
            setLiveTranscript(currentOutputTransRef.current);
        }

        // 4. Turn Complete
        if (serverContent?.turnComplete) {
            if (currentInputTransRef.current.trim()) {
                appendMessage({ id: Date.now().toString(), role: 'user', text: currentInputTransRef.current.trim(), timestamp: Date.now() });
                currentInputTransRef.current = '';
            }
            if (currentOutputTransRef.current.trim()) {
                appendMessage({ id: (Date.now() + 1).toString(), role: 'model', text: currentOutputTransRef.current.trim(), timestamp: Date.now() });
                currentOutputTransRef.current = '';
            }
            setLiveTranscript('');
        }
    };

    // --- Text Chat Logic ---

    const handleSendText = async () => {
        if (!inputValue.trim() || !chatSessionRef.current) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputValue.trim(), timestamp: Date.now() };

        appendMessage(userMsg); // Use persistence helper
        setInputValue('');
        setIsLoadingText(true);

        try {
            const result = await chatSessionRef.current.sendMessage({ message: inputValue });
            const responseText = result.text || "Entendi!";
            appendMessage({ id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() }); // Use persistence helper
        } catch (error) { console.error(error); } finally { setIsLoadingText(false); }
    };

    // --- Custom Animations CSS ---
    const waveKeyframes = `
    @keyframes wave {
      0%, 100% { height: 10px; }
      50% { height: 25px; }
    }
    @keyframes wave-active {
        0% { height: 10px; transform: scaleY(1); }
        50% { height: 35px; transform: scaleY(1.2); }
        100% { height: 10px; transform: scaleY(1); }
    }
    @keyframes breathing {
      0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.7); }
      70% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 0 20px rgba(96, 165, 250, 0); }
      100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
    }
    @keyframes float-text {
        0% { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
    }
  `;

    // --- Render ---

    const containerClasses = isEmbedded
        ? "w-full h-full flex flex-col bg-[#FFFFFF] border-l border-slate-200"
        : "fixed bottom-6 right-6 w-[380px] h-[650px] bg-white rounded-[32px] shadow-2xl border border-white/20 flex flex-col z-50 overflow-hidden glass";

    return (
        <div className={`${containerClasses} font-sans shadow-2xl ring-1 ring-black/5`}>
            <style>{waveKeyframes}</style>

            {/* Header */}
            <div className={`p-4 flex justify-between items-center z-10 ${isEmbedded ? 'bg-white/80 border-b border-slate-100' : 'bg-white/60 backdrop-blur-xl border-b border-white/30'}`}>
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <img src={ARIA_AVATAR_URL} alt="Aria" className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white" />
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isLiveMode ? (audioStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-green-400') : 'bg-green-400'}`}></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Aria</h3>
                        <p className="text-xs text-blue-500 font-medium">{isLiveMode ? (audioStatus === 'speaking' ? 'Falando...' : audioStatus === 'listening' ? 'Ouvindo...' : 'Conectando...') : 'Online'}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={toggleLiveMode}
                        className={`p-2 rounded-full transition-all duration-300 ${isLiveMode ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                        title={isLiveMode ? "Encerrar Chamada" : "Iniciar Conversa de Voz"}
                    >
                        {isLiveMode ? <Radio className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><X className="w-4 h-4 text-slate-600" /></button>
                </div>
            </div>

            {/* Voice UI Overlay (Live Mode) */}
            {isLiveMode && (
                <div className="bg-gradient-to-b from-white to-[#F8FAFC] p-6 flex flex-col items-center justify-center min-h-[240px] border-b border-slate-100 relative overflow-hidden transition-all duration-500">

                    {/* 1. VISUALIZER LAYER */}
                    <div className="relative flex items-center justify-center h-32 w-full mb-2">
                        {audioStatus === 'speaking' ? (
                            // Speaking: Dynamic Waveform
                            <div className="flex items-center justify-center space-x-1.5 h-full">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div
                                        key={i}
                                        className="w-2 bg-gradient-to-t from-[#007AFF] to-[#5AC8FA] rounded-full"
                                        style={{
                                            animation: `wave-active ${0.4 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
                                            animationDelay: `${i * 0.1}s`,
                                            height: '15px'
                                        }}
                                    ></div>
                                ))}
                            </div>
                        ) : audioStatus === 'listening' ? (
                            // Listening: Breathing Orb (More natural, organic)
                            <div className="relative flex items-center justify-center">
                                <div className="w-24 h-24 bg-blue-100/50 rounded-full absolute" style={{ animation: 'breathing 3s ease-in-out infinite' }}></div>
                                <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-cyan-500 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center z-10 transition-transform duration-300 transform scale-100">
                                    <Mic className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        ) : (
                            // Connecting: Loader
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                <span className="text-xs text-slate-400 font-medium">Conectando...</span>
                            </div>
                        )}
                    </div>

                    {/* 2. REAL-TIME TRANSCRIPT (Subtle, floating) */}
                    <div className="relative w-full text-center px-4 h-12 flex items-center justify-center">
                        {liveTranscript ? (
                            <div className="bg-white/80 backdrop-blur-sm border border-slate-100 shadow-sm rounded-full px-5 py-2 inline-block max-w-full" style={{ animation: 'float-text 0.3s ease-out forwards' }}>
                                <p className="text-slate-700 font-medium text-sm leading-none truncate flex items-center justify-center">
                                    {audioStatus === 'speaking' && <Sparkles className="w-3 h-3 text-blue-500 mr-2" />}
                                    {liveTranscript}
                                </p>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-xs font-medium animate-pulse">
                                {audioStatus === 'listening' ? 'Estou ouvindo...' : ''}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F2F2F7]">
                {messages.filter(msg => msg.text && msg.text.trim().length > 0).map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                        <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                            {msg.role === 'model' && <img src={ARIA_AVATAR_URL} className="w-6 h-6 rounded-full mb-1 shadow-sm" />}
                            <div
                                className={`px-4 py-2.5 rounded-[20px] text-[15px] leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-[#007AFF] text-white rounded-br-none'
                                        : 'bg-white text-[#1C1C1E] rounded-bl-none border border-slate-100'
                                    }`}
                            >
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoadingText && (
                    <div className="flex justify-start pl-8"><div className="bg-slate-200 rounded-full px-4 py-2 flex space-x-1"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div></div></div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 relative">
                <div className="flex items-center space-x-2 bg-[#E5E5EA] rounded-[24px] px-2 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#007AFF] transition-all">
                    <button className="p-2 text-slate-400 hover:text-[#007AFF] rounded-full transition-colors" disabled={isLiveMode}><Paperclip className="w-5 h-5" /></button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        placeholder={isLiveMode ? "Aria está ouvindo..." : "Mensagem para Aria..."}
                        disabled={isLiveMode}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] text-slate-800 placeholder-slate-400 h-9 disabled:opacity-50 disabled:placeholder-blue-400"
                    />
                    {isLiveMode ? (
                        <div className="p-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div></div>
                    ) : (
                        <button
                            onClick={handleSendText}
                            disabled={!inputValue.trim()}
                            className={`p-2 rounded-full transition-all duration-300 ${inputValue.trim() ? 'bg-[#007AFF] text-white shadow-md transform scale-100' : 'bg-slate-300 text-white scale-90'}`}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VirtualTutor;