import React, { useState } from 'react';
import { User, Badge, AriaReport } from '../types';
import { generateAriaReport } from '../services/geminiService';
import { User as UserIcon, Award, BarChart2, FileText, Edit2, Zap, Clock, Calendar, Download, Play, Pause, Sparkles, Loader, CheckCircle } from 'lucide-react';

interface ProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'evolution' | 'reports'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Edit States
  const [editName, setEditName] = useState(user.name);
  const [editLevel, setEditLevel] = useState(user.preferences.educationLevel);
  const [editProficiency, setEditProficiency] = useState(user.preferences.proficiency || 'intermediario');

  const handleSaveProfile = () => {
    onUpdateUser({ 
        ...user, 
        name: editName, 
        preferences: { 
            ...user.preferences, 
            educationLevel: editLevel,
            proficiency: editProficiency
        } 
    });
    setIsEditing(false);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const summary = await generateAriaReport(user);
      const newReport: AriaReport = { id: `rep-${Date.now()}`, date: new Date().toISOString(), summary: summary, score: user.evolution.averageScore };
      onUpdateUser({ ...user, reports: [newReport, ...user.reports] });
    } catch (e) { console.error(e); } finally { setIsGeneratingReport(false); }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto pb-32">
       {/* iOS Segmented Control */}
       <div className="bg-[#E5E5EA] p-1.5 rounded-2xl w-full md:w-fit flex mb-10 mx-auto md:mx-0 shadow-inner">
           {[
               {id: 'profile', label: 'Perfil'},
               {id: 'evolution', label: 'Evolução'},
               {id: 'reports', label: 'Relatórios'},
           ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                     activeTab === tab.id 
                     ? 'bg-white text-black shadow-sm scale-100' 
                     : 'text-slate-500 hover:text-slate-700 scale-95'
                 }`}
               >
                   {tab.label}
               </button>
           ))}
       </div>

       {activeTab === 'profile' && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white rounded-[32px] p-8 ios-card-shadow flex flex-col md:flex-row items-center md:items-start gap-8 border border-white/50">
            <div className="relative group">
               <img src={user.avatar || "https://ui-avatars.com/api/?name=" + user.name} alt={user.name} className="w-32 h-32 rounded-full object-cover border-[6px] border-slate-50 shadow-xl" />
               {user.provider === 'email' && (
                 <button className="absolute bottom-0 right-0 bg-[#007AFF] text-white p-2.5 rounded-full shadow-lg hover:bg-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
               )}
            </div>
            <div className="flex-1 w-full text-center md:text-left">
               <div className="flex flex-col md:flex-row justify-between items-center md:items-start mb-6">
                  <div>
                    {isEditing ? (
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-3xl font-bold text-center md:text-left text-slate-900 border-b-2 border-blue-500 outline-none pb-1 bg-transparent" />
                    ) : (
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{user.name}</h2>
                    )}
                    <p className="text-slate-500 font-medium">{user.email}</p>
                  </div>
                  <button onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)} className={`mt-4 md:mt-0 px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${isEditing ? 'bg-green-500 text-white shadow-green-200 shadow-lg' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    {isEditing ? 'Salvar' : 'Editar'}
                  </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F2F2F7] p-5 rounded-2xl">
                     <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1 block">Nível de Ensino</label>
                     {isEditing ? (
                       <select value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className="w-full bg-white p-2 rounded-lg text-sm">
                           <option value="fundamental_2">Fundamental II</option>
                           <option value="medio">Ensino Médio</option>
                           <option value="superior">Superior</option>
                           <option value="profissional">Profissional / Pós</option>
                       </select>
                     ) : (
                       <p className="text-lg font-bold text-slate-800 capitalize">{user.preferences.educationLevel.replace('_', ' ')}</p>
                     )}
                  </div>
                  
                  <div className="bg-[#F2F2F7] p-5 rounded-2xl">
                     <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1 block">Intelecto / Profundidade</label>
                     {isEditing ? (
                        <select value={editProficiency} onChange={(e: any) => setEditProficiency(e.target.value)} className="w-full bg-white p-2 rounded-lg text-sm">
                           <option value="basico">Básico (Fundamentos)</option>
                           <option value="intermediario">Médio (Prático)</option>
                           <option value="avancado">Avançado (Profundo)</option>
                           <option value="academico">Acadêmico (Teórico)</option>
                        </select>
                     ) : (
                        <div className="flex items-center justify-center md:justify-start">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${user.preferences.proficiency === 'academico' ? 'bg-purple-500' : user.preferences.proficiency === 'avancado' ? 'bg-red-500' : user.preferences.proficiency === 'intermediario' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                            <p className="text-lg font-bold text-slate-800 capitalize">{user.preferences.proficiency || 'Intermediário'}</p>
                        </div>
                     )}
                  </div>

                  <div className="bg-[#F2F2F7] p-5 rounded-2xl">
                     <label className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1 block">Estilo</label>
                     <p className="text-lg font-bold text-slate-800 capitalize">{user.preferences.learningStyle}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
       )}

       {activeTab === 'evolution' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-gradient-to-br from-[#5856D6] to-[#AF52DE] rounded-[32px] p-8 text-white shadow-xl shadow-purple-500/20 relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-purple-100 text-sm font-bold uppercase tracking-wide mb-1">Nível Atual</p>
                  <h3 className="text-5xl font-black">{user.evolution.level}</h3>
                  <div className="mt-6 w-full bg-black/20 rounded-full h-3 p-0.5 backdrop-blur-sm">
                     <div className="bg-white h-2 rounded-full transition-all duration-1000" style={{width: `${(user.evolution.totalXp % 1000) / 10}%`}}></div>
                  </div>
                  <p className="text-xs mt-2 font-medium opacity-90">{user.evolution.totalXp} XP Total</p>
                </div>
                <Zap className="absolute -right-6 -bottom-6 w-40 h-40 text-white opacity-10 group-hover:scale-110 transition-transform duration-700" />
             </div>

             <div className="bg-white rounded-[32px] p-8 ios-card-shadow border border-white/50 flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-500 shadow-sm"><Zap className="w-8 h-8 fill-current" /></div>
                 <h3 className="text-4xl font-black text-slate-900">{user.evolution.streakDays}</h3>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Dias Seguidos</p>
             </div>

             <div className="bg-white rounded-[32px] p-8 ios-card-shadow border border-white/50 flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-500 shadow-sm"><CheckCircle className="w-8 h-8" /></div>
                 <h3 className="text-4xl font-black text-slate-900">{user.evolution.modulesCompleted}</h3>
                 <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">Módulos</p>
             </div>
          </div>

          <div className="bg-white rounded-[32px] p-8 ios-card-shadow border border-white/50">
             <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center"><BarChart2 className="w-6 h-6 mr-3 text-blue-500" /> Domínio por Matéria</h3>
             <div className="space-y-6">
                 {Object.entries(user.evolution.subjectMastery).map(([subject, score]) => (
                   <div key={subject}>
                      <div className="flex justify-between mb-2">
                          <span className="font-bold text-slate-700">{subject}</span>
                          <span className="text-sm font-bold text-slate-500">{score as number}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-4">
                          <div className={`h-4 rounded-full transition-all duration-1000 shadow-sm ${(score as number) > 80 ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${score}%`}}></div>
                      </div>
                   </div>
                 ))}
             </div>
          </div>
        </div>
       )}

       {activeTab === 'reports' && (
        <div className="animate-fade-in space-y-6">
           <div className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] rounded-[32px] p-8 text-white shadow-xl shadow-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex items-center space-x-5">
                   <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30"><Sparkles className="w-8 h-8 text-white" /></div>
                   <div>
                       <h3 className="text-2xl font-bold">Relatórios da Aria</h3>
                       <p className="text-blue-100 mt-1 opacity-90">Análises semanais da sua performance.</p>
                   </div>
               </div>
               <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="bg-white text-blue-600 font-bold py-4 px-8 rounded-[20px] shadow-lg transition-transform active:scale-95 disabled:opacity-70 flex items-center">
                   {isGeneratingReport ? <Loader className="w-5 h-5 animate-spin" /> : 'Gerar Novo'}
               </button>
           </div>
           
           <div className="space-y-4">
               {user.reports.map(report => (
                   <div key={report.id} className="bg-white p-6 rounded-[24px] ios-card-shadow border border-white/50 hover:border-blue-200 transition-colors">
                       <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center space-x-2 text-slate-500 font-medium">
                               <Calendar className="w-4 h-4" />
                               <span>{new Date(report.date).toLocaleDateString()}</span>
                           </div>
                           <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Score: {report.score}%</span>
                       </div>
                       <p className="text-slate-700 leading-relaxed bg-[#F2F2F7] p-5 rounded-2xl text-sm border border-slate-200">{report.summary}</p>
                   </div>
               ))}
           </div>
        </div>
       )}
    </div>
  );
};

export default Profile;