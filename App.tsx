import React, { useState, useEffect } from 'react';
import { BookOpen, User as UserIcon, PlusCircle, LayoutDashboard, Brain, ChevronRight, CheckCircle2, Menu, LogOut, Loader, Search, Bot, PanelRightOpen, ImageIcon, Sparkles, X } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import LoginModal from './components/auth/LoginModal';
import { generateLessonPlan, generateModuleImage } from './services/geminiService';
import { LessonPlan, UserPreferences, ViewState, Module, User } from './types';
import VirtualTutor from './components/VirtualTutor';
import QuizComponent from './components/QuizComponent';
import Onboarding from './components/Onboarding';
import Profile from './components/Profile';

// --- Database Helper Imports ---
import { saveLegacyPlan, getUserPlans, syncUserProfile } from './services/supabase';
import Library from './components/Library';

// Helper to migrate local storage data once
const migrateLocalData = async (user: User) => {
    const migrated = localStorage.getItem('eduia_migrated_v1');
    if (migrated) return;

    try {
        const storedPlans = localStorage.getItem('edu_plans');
        if (storedPlans) {
            const plans = JSON.parse(storedPlans);
            for (const plan of plans) {
                // Ensure legacy plans are saved to Supabase
                await saveLegacyPlan(plan, user.id);
            }
        }
        localStorage.setItem('eduia_migrated_v1', 'true');
        // Optional: localStorage.removeItem('edu_plans');
    } catch (e) {
        console.error("Migration failed", e);
    }
};

// --- Main App ---
function App() {
    console.log("App component rendered");
    const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
    const { getToken, signOut } = useAuth();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const syncUser = async () => {
            if (isClerkLoaded) {
                if (clerkUser) {
                    try {
                        const token = await getToken();
                        const email = clerkUser.primaryEmailAddress?.emailAddress;

                        // Sync with Supabase Profile (Upsert)
                        await syncUserProfile({
                            id: clerkUser.id,
                            primaryEmailAddress: { emailAddress: email },
                            fullName: clerkUser.fullName,
                            imageUrl: clerkUser.imageUrl
                        });

                        // Maintain legacy server sync for session cookie (Proxy Auth)
                        if (email && token) {
                            const res = await fetch('/api/auth/sync', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, token })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                // Merge backend data with Clerk data
                                const mergedUser = { ...data.user, id: clerkUser.id, name: clerkUser.fullName, avatar: clerkUser.imageUrl };
                                setCurrentUser(mergedUser);

                                // Perform Migration
                                migrateLocalData(mergedUser).then(() => {
                                    // Load Plans from Supabase
                                    getUserPlans(clerkUser.id).then(({ data }) => {
                                        if (data) setPlans(data as LessonPlan[]);
                                    });
                                });
                            }
                        }
                    } catch (e) { console.error(e); }
                } else {
                    setCurrentUser(null);
                }
                setIsLoadingAuth(false);
            }
        };
        syncUser();
    }, [isClerkLoaded, clerkUser, getToken]);

    const handleLogout = () => { signOut(); setCurrentUser(null); };
    const handleAuthComplete = (user: User) => { setCurrentUser(user); }; // Fallback/Legacy
    const handleUpdateUser = (updatedUser: User) => { setCurrentUser(updatedUser); localStorage.setItem('edu_user_data', JSON.stringify(updatedUser)); };

    const [view, setView] = useState<ViewState>('dashboard');
    const [plans, setPlans] = useState<LessonPlan[]>([]);
    const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
    const [isTutorOpen, setIsTutorOpen] = useState(false); // Default closed in Dashboard
    const [tutorInitialLive, setTutorInitialLive] = useState(false); // State to trigger auto-live

    const [subjectInput, setSubjectInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    // Initial state updated to include proficiency
    const [preferences, setPreferences] = useState<UserPreferences>({ educationLevel: 'medio', proficiency: 'intermediario', learningStyle: 'visual', favoriteSubjects: [] });

    useEffect(() => { if (currentUser?.preferences) setPreferences(currentUser.preferences); }, [currentUser]);
    useEffect(() => { if (currentUser?.preferences) setPreferences(currentUser.preferences); }, [currentUser]);
    // Removed old getPlans effect since we load in syncUser now


    const handleGenerate = async () => {
        if (!subjectInput.trim()) return;
        setIsGenerating(true);
        try {
            const partialPlan = await generateLessonPlan(subjectInput, preferences);
            const newPlan: LessonPlan = {
                id: Date.now().toString(),
                subject: partialPlan.subject || subjectInput,
                createdAt: new Date().toISOString(),
                progress: 0,
                modules: partialPlan.modules?.map((m: any) => ({ ...m, isCompleted: false })) || []
            };

            // Optimistic Update
            setPlans(prev => [...prev, newPlan]);
            setActivePlan(newPlan);

            // Save to DB
            if (currentUser) {
                saveLegacyPlan(newPlan, currentUser.id).then(({ error }) => {
                    if (error) console.error("Failed to save plan", error);
                });
            }
            setView('planner');
            setIsTutorOpen(true);
            setTutorInitialLive(false);
            setSubjectInput('');
        } catch (error) { alert("Erro ao gerar plano. Tente novamente."); }
        finally { setIsGenerating(false); }
    };

    const handleModuleComplete = (moduleId: string) => {
        if (!activePlan || !currentUser) return;

        // Find module index
        const updatedModules = activePlan.modules.map(m => {
            if (m.id === moduleId) return { ...m, isCompleted: true };
            return m;
        });

        const completedCount = updatedModules.filter(m => m.isCompleted).length;
        const progress = Math.round((completedCount / updatedModules.length) * 100);

        const updatedPlan = { ...activePlan, modules: updatedModules, progress };

        setActivePlan(updatedPlan);
        // Update Plans List Optimistically
        setPlans(prev => prev.map(p => p.id === activePlan.id ? updatedPlan : p));

        // Save to DB
        saveLegacyPlan(updatedPlan, currentUser.id);

        // Simple Evolution Logic Mock
        const newXp = (currentUser.evolution?.totalXp || 0) + 150;
        const updatedUser = {
            ...currentUser,
            evolution: {
                ...currentUser.evolution,
                totalXp: newXp,
                level: Math.floor(newXp / 1000) + 1,
                modulesCompleted: (currentUser.evolution?.modulesCompleted || 0) + 1,
                subjectMastery: { ...currentUser.evolution?.subjectMastery, [activePlan.subject]: ((currentUser.evolution?.subjectMastery?.[activePlan.subject] || 0) + 10) }
            }
        };
        handleUpdateUser(updatedUser);
    };

    const handleModuleImageGenerated = (moduleId: string, base64Image: string) => {
        if (!activePlan) return;
        const updatedModules = activePlan.modules.map(m => m.id === moduleId ? { ...m, generatedImage: base64Image } : m);
        const updatedPlan = { ...activePlan, modules: updatedModules };

        setActivePlan(updatedPlan);

        // Optimistic
        setPlans(prev => prev.map(p => p.id === activePlan.id ? updatedPlan : p));

        if (currentUser) saveLegacyPlan(updatedPlan, currentUser.id);
    };

    const handleNav = (target: ViewState) => {
        setView(target);
        if (target === 'dashboard') setActivePlan(null);
        setIsMobileMenuOpen(false);
    };

    const handleOpenLiveTutor = () => {
        setTutorInitialLive(true);
        setIsTutorOpen(true);
    };

    // --- iOS 26.1 UI Components ---

    const renderSidebar = () => (
        <>
            {/* Desktop Sidebar */}
            <div className="w-[280px] bg-[#0C1D40]/95 backdrop-blur-xl text-white flex flex-col h-screen fixed left-0 top-0 z-30 hidden md:flex border-r border-white/5 shadow-2xl">
                <div className="p-8 pt-10 flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-2xl shadow-lg shadow-blue-500/30">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">EduIA</span>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Início' },
                        { id: 'library', icon: BookOpen, label: 'Biblioteca' },
                        { id: 'profile', icon: UserIcon, label: 'Perfil' }
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNav(item.id as ViewState)}
                            className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 tap-scale ${view === item.id
                                ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white font-semibold'
                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-base">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-6">
                    <div className="flex items-center space-x-3 px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/5 hover:bg-white/15 transition-colors cursor-pointer group" onClick={handleLogout}>
                        {currentUser?.avatar ? (
                            <img src={currentUser.avatar} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-white/20 object-cover" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                                {currentUser?.name.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold text-white truncate">{currentUser?.name}</p>
                            <p className="text-xs text-blue-200 truncate">Sair da conta</p>
                        </div>
                        <LogOut className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[#0C1D40] text-white p-6 animate-slide-right flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center space-x-2">
                                <Brain className="w-6 h-6 text-blue-400" />
                                <span className="text-xl font-bold">EduIA</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <nav className="space-y-2">
                            {['dashboard', 'library', 'profile'].map((id) => (
                                <button key={id} onClick={() => handleNav(id as ViewState)} className="block w-full text-left py-4 px-4 rounded-xl hover:bg-white/10 capitalize font-medium text-lg">
                                    {id === 'dashboard' ? 'Início' : id === 'library' ? 'Biblioteca' : 'Perfil'}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            )}
        </>
    );



    // ... inside App component

    // Instead of activePlan management only, we just route to Library component
    // ...

    const renderDashboard = () => (
        <div className="flex flex-col h-screen overflow-y-auto bg-[#F2F2F7] pb-24 md:pb-0">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-b from-[#007AFF] to-[#5AC8FA] p-8 pb-16 md:rounded-bl-[40px] md:rounded-br-[40px] shadow-lg text-white">
                <div className="max-w-6xl mx-auto pt-4 md:pt-0">
                    <div className="flex justify-between items-center mb-6 md:hidden">
                        <Brain className="w-8 h-8 text-white" />
                        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-white/20 rounded-full"><Menu className="w-6 h-6" /></button>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">
                        Olá, {currentUser?.name.split(' ')[0]}!
                    </h1>
                    <p className="text-blue-100 text-lg opacity-90 mb-8">O que vamos descobrir hoje com a Aria?</p>

                    {/* Search Bar */}
                    <div className="bg-white/20 backdrop-blur-md p-1 rounded-[24px] flex items-center shadow-inner border border-white/30 max-w-2xl">
                        <div className="bg-white rounded-[20px] flex-1 flex items-center px-4 py-3 shadow-sm">
                            <Search className="w-5 h-5 text-slate-400 mr-3" />
                            <input
                                type="text"
                                value={subjectInput}
                                onChange={(e) => setSubjectInput(e.target.value)}
                                placeholder="Ex: Buracos Negros, Renascimento..."
                                className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-base font-medium"
                            />
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !subjectInput}
                            className="ml-2 bg-[#007AFF] hover:bg-blue-600 text-white p-3 px-6 rounded-[20px] font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center"
                        >
                            {isGenerating ? <Loader className="animate-spin w-5 h-5" /> : <><Sparkles className="w-5 h-5 mr-1" /> Criar</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto w-full px-6 -mt-10 mb-12 space-y-10">
                {/* Stats / Quick Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
                    <div className="bg-white rounded-[28px] p-6 ios-card-shadow flex items-center space-x-4 tap-scale cursor-pointer" onClick={() => handleNav('profile')}>
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                            <Brain className="w-7 h-7" />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900">Evolução Mental</h4>
                            <p className="text-slate-500 text-sm">Nível {currentUser?.evolution?.level} • {currentUser?.evolution?.streakDays} dias seguidos</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                    </div>

                    <div
                        className="bg-white rounded-[28px] p-6 ios-card-shadow flex items-center space-x-4 tap-scale cursor-pointer"
                        onClick={handleOpenLiveTutor}
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-400 to-yellow-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                            <Bot className="w-7 h-7" />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900">Falar com Aria</h4>
                            <p className="text-slate-500 text-sm">Pratique conversação agora</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                    </div>

                    <div
                        className="bg-white rounded-[28px] p-6 ios-card-shadow flex items-center space-x-4 tap-scale cursor-pointer md:col-span-2"
                        onClick={() => handleNav('library')}
                    >
                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <BookOpen className="w-7 h-7" />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900">Meus Caminhos de Aprendizado</h4>
                            <p className="text-slate-500 text-sm">Acesse todos os seus planos e continue estudando.</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                    </div>
                </div>
            </div>
        </div>
    );

    // ...

    return (
        <div className="min-h-screen bg-[#F2F2F7] font-sans md:pl-[280px]">
            {renderSidebar()}

            <main className="h-screen overflow-hidden relative">
                {view === 'dashboard' && renderDashboard()}
                {view === 'planner' && renderPlanner()}
                {view === 'library' && currentUser && (
                    <div className="h-full overflow-y-auto">
                        <Library
                            userId={currentUser.id}
                            onOpenPlan={(plan) => { setActivePlan(plan); setView('planner'); }}
                            onNewPlan={() => setView('dashboard')}
                        />
                    </div>
                )}
                {view === 'profile' && currentUser && (
                    <div className="h-full overflow-y-auto">
                        <Profile user={currentUser} onUpdateUser={handleUpdateUser} />
                    </div>
                )}
            </main>

            {/* Mobile / Dashboard Tutor Overlay */}
            {isTutorOpen && (view === 'planner' || (view === 'dashboard' && isTutorOpen)) && (
                <div className={view === 'planner' ? "md:hidden" : ""}>
                    <VirtualTutor
                        currentPlan={activePlan}
                        onClose={() => setIsTutorOpen(false)}
                        mode="modal"
                        userName={currentUser?.name || "Estudante"}
                        userId={currentUser?.id}
                        initialLiveMode={tutorInitialLive}
                    />
                </div>
            )}
        </div>
    );

    const renderPlanner = () => {
        if (!activePlan) return null;
        return (
            <div className="flex h-screen overflow-hidden bg-[#F2F2F7]">
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-6 md:p-10 max-w-5xl mx-auto pb-32">
                        <button onClick={() => setView('dashboard')} className="group flex items-center text-slate-500 hover:text-[#007AFF] font-medium mb-6 transition-colors">
                            <div className="bg-white p-2 rounded-full shadow-sm mr-2 group-hover:shadow-md transition-all">
                                <ChevronRight className="w-4 h-4 rotate-180" />
                            </div>
                            Voltar
                        </button>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                            <div>
                                <span className="text-[#007AFF] font-bold tracking-wider uppercase text-xs mb-2 block">Plano de Estudo</span>
                                <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight">{activePlan.subject}</h1>
                            </div>
                            <button
                                onClick={() => setIsTutorOpen(!isTutorOpen)}
                                className={`px-5 py-3 rounded-full flex items-center shadow-lg transition-all active:scale-95 font-bold text-sm ${isTutorOpen
                                    ? 'bg-white text-slate-900 border border-slate-200'
                                    : 'bg-[#007AFF] text-white hover:bg-blue-600'
                                    }`}
                            >
                                {isTutorOpen ? <PanelRightOpen className="w-4 h-4 mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
                                {isTutorOpen ? 'Ocultar Aria' : 'Ajuda da Aria'}
                            </button>
                        </div>

                        <div className="space-y-6">
                            {activePlan.modules.map((module, idx) => (
                                <ModuleCard
                                    key={module.id}
                                    module={module}
                                    index={idx}
                                    onComplete={() => handleModuleComplete(module.id)}
                                    onImageGenerated={(img) => handleModuleImageGenerated(module.id, img)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                {isTutorOpen && (
                    <div className="w-[380px] shrink-0 h-full border-l border-slate-200 bg-white shadow-2xl z-20 hidden md:block">
                        <VirtualTutor
                            currentPlan={activePlan}
                            onClose={() => setIsTutorOpen(false)}
                            mode="embedded"
                            userName={currentUser?.name || "Estudante"}
                            userId={currentUser?.id}
                            initialLiveMode={tutorInitialLive}
                        />
                    </div>
                )}
            </div>
        );
    };

    if (isLoadingAuth) return <div className="h-screen flex items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin w-10 h-10 text-[#007AFF]" /></div>;
    // If not logged in, show LoginModal
    if (!currentUser) return <LoginModal onClose={() => { }} />;

    return (
        <div className="min-h-screen bg-[#F2F2F7] font-sans md:pl-[280px]">
            {renderSidebar()}

            <main className="h-screen overflow-hidden relative">
                {view === 'dashboard' && renderDashboard()}
                {view === 'planner' && renderPlanner()}
                {view === 'library' && renderDashboard()}
                {view === 'profile' && currentUser && <Profile user={currentUser} onUpdateUser={handleUpdateUser} />}
            </main>

            {/* Mobile / Dashboard Tutor Overlay */}
            {isTutorOpen && (view === 'planner' || (view === 'dashboard' && isTutorOpen)) && (
                <div className={view === 'planner' ? "md:hidden" : ""}>
                    <VirtualTutor
                        currentPlan={activePlan}
                        onClose={() => setIsTutorOpen(false)}
                        mode="modal"
                        userName={currentUser?.name || "Estudante"}
                        userId={currentUser?.id}
                        initialLiveMode={tutorInitialLive}
                    />
                </div>
            )}
        </div>
    );
}

// --- Internal Component: ModuleCard (Updated Style) ---
const ModuleCard: React.FC<{ module: Module, index: number, onComplete: () => void, onImageGenerated: (base64: string) => void }> = ({ module, index, onComplete, onImageGenerated }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isGeneratingImg, setIsGeneratingImg] = useState(false);

    useEffect(() => {
        const generateImg = async () => {
            if (isOpen && !module.generatedImage && !isGeneratingImg) {
                setIsGeneratingImg(true);
                const img = await generateModuleImage(module.title, module.visualKeyword);
                if (img) onImageGenerated(img);
                setIsGeneratingImg(false);
            }
        };
        generateImg();
    }, [isOpen, module.generatedImage]);

    return (
        <div className={`bg-white rounded-[24px] ios-card-shadow overflow-hidden transition-all duration-300 border ${module.isCompleted ? 'border-green-400/50 shadow-green-100' : 'border-white/60'}`}>
            <div
                className={`p-6 flex items-center cursor-pointer tap-scale ${module.isCompleted ? 'bg-green-50/30' : 'hover:bg-slate-50'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mr-5 shrink-0 shadow-sm ${module.isCompleted ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {module.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : index + 1}
                </div>
                <h3 className={`text-lg font-bold flex-1 leading-tight ${module.isCompleted ? 'text-green-800' : 'text-slate-900'}`}>{module.title}</h3>
                <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-90 bg-blue-100 text-blue-600' : 'text-slate-400'}`}>
                    <ChevronRight className="w-5 h-5" />
                </div>
            </div>

            {isOpen && (
                <div className="p-6 pt-0 animate-fade-in">
                    <div className="w-full h-64 bg-slate-100 rounded-2xl mb-6 mt-2 overflow-hidden relative group border border-slate-200 shadow-inner">
                        {module.generatedImage ? (
                            <>
                                <img src={module.generatedImage} alt={module.visualKeyword} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center border border-white/20">
                                    <Sparkles className="w-3 h-3 mr-1.5 text-yellow-400" /> IA Visual: {module.visualKeyword}
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                {isGeneratingImg ? (
                                    <><Loader className="w-8 h-8 animate-spin text-blue-500 mb-2" /><span className="text-sm font-medium text-blue-600 animate-pulse">Desenhando conceito...</span></>
                                ) : (
                                    <><ImageIcon className="w-12 h-12 mb-2 opacity-30" /><span>Aguardando visualização...</span></>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="prose prose-slate prose-lg max-w-none mb-8 text-slate-600 leading-relaxed font-normal">
                        {module.content.split('\n').map((p, i) => <p key={i} className="mb-4">{p}</p>)}
                    </div>
                    <div className="bg-[#F2F2F7] rounded-3xl p-6 border border-slate-200/60">
                        <div className="flex items-center mb-6">
                            <div className="bg-[#007AFF] p-2 rounded-xl mr-3 shadow-lg shadow-blue-500/20"><BookOpen className="w-5 h-5 text-white" /></div>
                            <h4 className="font-bold text-slate-900 text-lg">Quiz Rápido</h4>
                        </div>
                        <QuizComponent questions={module.quiz} onComplete={onComplete} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;