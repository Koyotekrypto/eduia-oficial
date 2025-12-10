import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, ChevronRight, Loader2, PlusCircle } from 'lucide-react';
import { carregarBiblioteca } from '../services/supabase';
import { LessonPlan } from '../types';

interface LibraryProps {
    userId: string;
    onOpenPlan: (plan: LessonPlan) => void;
    onNewPlan: () => void;
}

// Helper to format date relative
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
};

const Library: React.FC<LibraryProps> = ({ userId, onOpenPlan, onNewPlan }) => {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const { data } = await carregarBiblioteca(userId);
            setPlans(data);
            setLoading(false);
        };
        fetchData();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[50vh]">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
        );
    }

    // View Structure
    return (
        <div className="p-6 md:p-10 pb-32 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Meus Caminhos de Aprendizado</h1>
                <button onClick={onNewPlan} className="md:hidden p-2 bg-blue-100 text-blue-600 rounded-full">
                    <PlusCircle className="w-6 h-6" />
                </button>
            </div>

            {plans.length === 0 ? (
                // Empty State (Reused from Dashboard)
                <div
                    onClick={onNewPlan}
                    className="bg-white border-2 border-dashed border-slate-300 rounded-[24px] p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors h-64"
                >
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <PlusCircle className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Crie seu primeiro plano</h3>
                    <p className="text-slate-500 max-w-xs">A Aria vai criar um caminho personalizado para você aprender qualquer coisa.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            onClick={() => {
                                // Map DB structure back to LessonPlan type if needed strictly, 
                                // or assume component handles it. We pass minimal compatible object.
                                // For full functionality, we might need to fetch full plan details or ensured modules exist.
                                // We assume 'modulos' column has the JSON.
                                onOpenPlan({
                                    ...plan,
                                    subject: plan.titulo || plan.assunto,
                                    createdAt: plan.updated_at // fallback
                                } as LessonPlan);
                            }}
                            className="bg-white rounded-[24px] overflow-hidden ios-card-shadow border border-slate-100 group cursor-pointer tap-scale hover:shadow-xl transition-all duration-300 relative"
                        >
                            {/* Image Header / Gradient */}
                            <div className="h-32 bg-gradient-to-br from-blue-400 to-indigo-600 relative overflow-hidden">
                                {plan.modulos?.[0]?.generatedImage ? (
                                    <img src={plan.modulos[0].generatedImage} alt="" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                        <BookOpen className="w-16 h-16 text-white" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                            </div>

                            <div className="p-5">
                                <h3 className="font-bold text-slate-900 text-lg leading-tight mb-2 line-clamp-2 h-12">
                                    {plan.titulo || plan.assunto}
                                </h3>

                                <div className="flex items-center text-slate-400 text-xs font-medium mb-4">
                                    <Calendar className="w-3.5 h-3.5 mr-1" />
                                    <span>Atualizado {formatDate(plan.updated_at)}</span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-600">
                                        <span>{plan.progresso}% Concluído</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                        <div className="bg-[#007AFF] h-full rounded-full transition-all duration-1000" style={{ width: `${plan.progresso}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 flex justify-center border-t border-slate-100">
                                <span className="text-blue-600 font-bold text-sm flex items-center">
                                    Continuar com Aria <ChevronRight className="w-4 h-4 ml-1" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Library;
