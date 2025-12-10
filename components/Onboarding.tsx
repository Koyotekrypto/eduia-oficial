import React, { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, ArrowRight, BookOpen, Cpu, Zap, Play, CheckCircle2, ChevronRight, GraduationCap, Palette, Music, Volume2, VolumeX } from 'lucide-react';
import { User } from '../types';

interface OnboardingProps { onComplete: (user: User) => void; }

// --- Assets & Constants ---
// Images matching the AI prompts requested
const IMG_WELCOME = "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1000&auto=format&fit=crop"; // Student with futuristic vibe
const IMG_BG_ABSTRACT = "https://images.unsplash.com/photo-1620641788421-7f1c33850486?q=80&w=1000&auto=format&fit=crop"; // Abstract blue tech

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0); // 0=Splash, 1=Welcome, 2=HowTo, 3=Highlights, 4=Login, 5=ProfileSetup
  const [isAudioOn, setIsAudioOn] = useState(false);
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile State (Legacy steps maintained for data integrity)
  const [partialUser, setPartialUser] = useState<Partial<User> | null>(null);
  const [educationLevel, setEducationLevel] = useState('medio');
  const [proficiency, setProficiency] = useState<'basico' | 'intermediario' | 'avancado' | 'academico'>('intermediario');
  const [learningStyle, setLearningStyle] = useState('visual');
  const [subjects, setSubjects] = useState<string[]>([]);

  // --- Audio Logic ---
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Splash Timer
    if (step === 0) {
        const timer = setTimeout(() => setStep(1), 3500);
        return () => clearTimeout(timer);
    }
  }, [step]);

  const toggleAudio = () => {
      setIsAudioOn(!isAudioOn);
      // In a real app, this would play an actual MP3
  };

  const nextStep = () => setStep(prev => prev + 1);
  const skipToLogin = () => setStep(4);

  // --- Auth Handlers ---
  const handleAuthSuccess = (u: Partial<User>) => {
      setPartialUser({ 
          ...u, 
          onboardingCompleted: false, 
          preferences: { educationLevel: 'medio', proficiency: 'intermediario', learningStyle: 'visual', favoriteSubjects: [] }, 
          evolution: { totalXp: 0, level: 1, streakDays: 0, modulesCompleted: 0, quizzesTaken: 0, averageScore: 0, subjectMastery: {} }, 
          badges: [], 
          reports: [] 
      });
      setStep(5); // Go to Profile Setup
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Simulate Login
      if(email) handleAuthSuccess({ id: 'u-' + Date.now(), name: email.split('@')[0], email, provider: 'email' });
  };
  
  const handleSocialLogin = (provider: 'google' | 'apple') => {
      handleAuthSuccess({ id: 'u-' + Date.now(), name: 'Estudante Novo', email: `student@${provider}.com`, provider: 'google' });
  };

  const completeOnboarding = () => {
      if(!partialUser) return;
      const final: User = { 
          ...(partialUser as User), 
          onboardingCompleted: true, 
          preferences: { educationLevel, proficiency, learningStyle, favoriteSubjects: subjects } 
      };
      localStorage.setItem('eduia_user', JSON.stringify(final));
      onComplete(final);
  };

  // --- Render Components ---

  // 0. Splash Screen
  if (step === 0) return (
      <div className="h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#1e40af] to-white flex flex-col items-center justify-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/20 animate-pulse-slow">
                  <div className="relative">
                      <Brain className="w-12 h-12 text-white absolute top-0 left-0" />
                      <BookOpen className="w-8 h-8 text-cyan-300 absolute -bottom-2 -right-2 opacity-80" />
                  </div>
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
                  <span className="inline-block animate-typewriter overflow-hidden whitespace-nowrap border-r-4 border-cyan-400 pr-1">EduIA</span>
              </h1>
              <p className="text-blue-100 font-medium text-sm tracking-wide opacity-0 animate-fade-in-delay">Seu professor particular com IA</p>
          </div>
          {/* Background Particles */}
          <div className="absolute inset-0 z-0 opacity-30">
              <div className="absolute top-10 left-10 w-32 h-32 bg-cyan-500 rounded-full blur-[100px] animate-blob"></div>
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-blue-600 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
          </div>
      </div>
  );

  // Common Header for Steps 1-3
  const SkipButton = () => (
      <button onClick={skipToLogin} className="absolute top-6 right-6 z-50 text-white/80 hover:text-white text-sm font-semibold bg-black/20 backdrop-blur-md px-4 py-2 rounded-full transition-all">
          Pular
      </button>
  );

  const AudioToggle = () => (
      <button onClick={toggleAudio} className="absolute top-6 left-6 z-50 text-white/80 hover:text-white p-2 rounded-full bg-black/20 backdrop-blur-md transition-all">
          {isAudioOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>
  );

  // 1. Welcome Screen
  if (step === 1) return (
      <div className="h-screen w-full relative bg-slate-900 flex flex-col justify-end pb-12 overflow-hidden">
          <img src={IMG_WELCOME} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Futuristic Student" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent"></div>
          <SkipButton />
          <AudioToggle />
          
          <div className="relative z-10 px-8 max-w-lg mx-auto w-full animate-slide-up">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-6 backdrop-blur-md">
                  <Sparkles className="w-3 h-3 mr-2 fill-current" /> NOVA ERA DA EDUCAÇÃO
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-[1.1] mb-4">
                  Bem-vindo ao <br/> <span className="text-cyan-400">futuro do aprendizado.</span>
              </h1>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                  Crie planos de estudo personalizados e tenha um Professor Virtual 24h só para você.
              </p>
              <button onClick={nextStep} className="w-full bg-[#007AFF] hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center transition-transform active:scale-95 group">
                  Continuar <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
          </div>
      </div>
  );

  // 2. How it Works
  if (step === 2) return (
      <div className="h-screen w-full bg-[#0f172a] text-white flex flex-col relative overflow-hidden">
          <img src={IMG_BG_ABSTRACT} className="absolute inset-0 w-full h-full object-cover opacity-20" />
          <SkipButton />
          
          <div className="flex-1 flex flex-col justify-center px-8 relative z-10 max-w-lg mx-auto w-full">
              <h2 className="text-3xl font-bold mb-10 text-center">Como funciona?</h2>
              
              <div className="space-y-8 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-700/50">
                  {[
                      { icon: Brain, title: "Digite o assunto", desc: "Qualquer tema: Física Quântica a História da Arte." },
                      { icon: BookOpen, title: "Receba o plano", desc: "Módulos, imagens e quizzes gerados na hora." },
                      { icon: Zap, title: "Converse com a IA", desc: "Tire dúvidas ao vivo com sua Professora Virtual." }
                  ].map((item, idx) => (
                      <div key={idx} className="flex items-start animate-fade-in-right" style={{animationDelay: `${idx * 200}ms`}}>
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0 z-10 shadow-lg shadow-blue-500/20 ring-4 ring-[#0f172a]">
                              <item.icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-6 pt-1">
                              <h3 className="text-lg font-bold text-white">{idx + 1}. {item.title}</h3>
                              <p className="text-slate-400 text-sm mt-1">{item.desc}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="p-8 relative z-10 max-w-lg mx-auto w-full">
              <button onClick={nextStep} className="w-full bg-white text-slate-900 font-bold py-4 rounded-2xl hover:bg-slate-100 transition-colors flex items-center justify-center">
                  Próximo
              </button>
          </div>
      </div>
  );

  // 3. Highlights
  if (step === 3) return (
      <div className="h-screen w-full bg-slate-50 flex flex-col relative">
          <SkipButton />
          <div className="flex-1 flex flex-col justify-center px-8 max-w-lg mx-auto w-full">
             <div className="mb-8">
                 <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                     <Cpu className="w-8 h-8" />
                 </div>
                 <h2 className="text-3xl font-bold text-slate-900 mb-2">Por que usar o EduIA?</h2>
                 <p className="text-slate-500">Tecnologia de ponta para sua evolução.</p>
             </div>

             <div className="space-y-4">
                 {[
                     "Plano de estudos 100% personalizado",
                     "Professor IA com memória de longo prazo",
                     "Geração de imagens e áudio nativa",
                     "Totalmente grátis para começar"
                 ].map((text, idx) => (
                     <div key={idx} className="flex items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-slide-up" style={{animationDelay: `${idx * 150}ms`}}>
                         <CheckCircle2 className="w-6 h-6 text-green-500 mr-4 shrink-0" />
                         <span className="text-slate-700 font-medium">{text}</span>
                     </div>
                 ))}
             </div>
          </div>

          <div className="p-8 max-w-lg mx-auto w-full">
              <button onClick={nextStep} className="w-full bg-[#007AFF] hover:bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center transition-transform active:scale-95">
                  Começar agora <ArrowRight className="ml-2 w-5 h-5" />
              </button>
          </div>
      </div>
  );

  // 4. Login / Register
  if (step === 4) return (
      <div className="h-screen w-full bg-white flex flex-col justify-center p-8">
          <div className="max-w-md mx-auto w-full">
              <div className="text-center mb-10">
                  <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-[20px] flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
                      <Brain className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">Criar conta</h2>
                  <p className="text-slate-500 mt-2">Salve seu progresso e acesse de qualquer lugar.</p>
              </div>

              <div className="space-y-4 mb-8">
                  <button onClick={() => handleSocialLogin('google')} className="w-full py-3.5 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center relative">
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Entrar com Google
                  </button>
                  <button onClick={() => handleSocialLogin('apple')} className="w-full py-3.5 bg-black text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center">
                      <svg className="w-5 h-5 mr-3 fill-current" viewBox="0 0 384 512"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/></svg>
                      Entrar com Apple
                  </button>
              </div>

              <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-400">ou continue com email</span></div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800" />
                  <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800" />
                  
                  <button onClick={handleLogin} className="w-full bg-[#007AFF] hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                      Entrar / Criar Conta
                  </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-6 px-4">
                  Ao continuar você aceita nossos <span className="underline cursor-pointer">Termos de Uso</span> e <span className="underline cursor-pointer">Política de Privacidade</span>.
              </p>
          </div>
      </div>
  );

  // 5. Setup Profile (Existing logic, styled)
  return (
      <div className="h-screen bg-[#F2F2F7] flex flex-col p-6 overflow-y-auto">
          <div className="mt-8 mb-8 text-center animate-fade-in">
               <h2 className="text-3xl font-bold text-slate-900">Quase lá, {partialUser?.name?.split(' ')[0]}!</h2>
               <p className="text-slate-500">Ajude a Aria a personalizar seu ensino.</p>
          </div>
          <div className="space-y-6 flex-1 max-w-lg mx-auto w-full">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                  <div className="flex items-center mb-4 text-blue-600 font-bold"><GraduationCap className="w-5 h-5 mr-2"/> Nível Escolar</div>
                  <select value={educationLevel} onChange={e => setEducationLevel(e.target.value)} className="w-full p-4 bg-[#F2F2F7] rounded-xl font-medium outline-none text-slate-900 focus:ring-2 focus:ring-blue-500">
                      <option value="fundamental_2">Fundamental II</option>
                      <option value="medio">Ensino Médio</option>
                      <option value="superior">Superior</option>
                      <option value="profissional">Profissional / Pós</option>
                  </select>
              </div>
              
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                  <div className="flex items-center mb-4 text-orange-600 font-bold"><Zap className="w-5 h-5 mr-2"/> Ritmo de Estudo</div>
                  <div className="grid grid-cols-2 gap-3">
                      {[
                        {val: 'basico', label: 'Básico', desc: 'Conceitual'},
                        {val: 'intermediario', label: 'Médio', desc: 'Prático'},
                        {val: 'avancado', label: 'Avançado', desc: 'Profundo'},
                        {val: 'academico', label: 'Expert', desc: 'Teórico'}
                      ].map(opt => (
                          <button 
                            key={opt.val} 
                            onClick={() => setProficiency(opt.val as any)} 
                            className={`p-3 rounded-xl border-2 text-left transition-all ${proficiency === opt.val ? 'border-orange-500 bg-orange-50' : 'border-transparent bg-[#F2F2F7]'}`}
                          >
                             <div className={`font-bold text-sm ${proficiency === opt.val ? 'text-orange-700' : 'text-slate-700'}`}>{opt.label}</div>
                             <div className="text-[10px] text-slate-500 mt-1">{opt.desc}</div>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-200">
                  <div className="flex items-center mb-4 text-purple-600 font-bold"><Palette className="w-5 h-5 mr-2"/> Estilo Visual</div>
                  <div className="grid grid-cols-2 gap-3">
                      {['visual', 'auditivo'].map(s => (
                          <button key={s} onClick={() => setLearningStyle(s)} className={`p-3 rounded-xl font-bold border-2 capitalize ${learningStyle === s ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-transparent bg-[#F2F2F7] text-slate-500'}`}>{s}</button>
                      ))}
                  </div>
              </div>
          </div>
          <div className="mt-8 max-w-lg mx-auto w-full"><button onClick={completeOnboarding} className="w-full bg-[#007AFF] hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center">Finalizar <CheckCircle2 className="ml-2 w-5 h-5"/></button></div>
      </div>
  );
};

export default Onboarding;