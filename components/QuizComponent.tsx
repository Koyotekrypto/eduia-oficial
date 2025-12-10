import React, { useState } from 'react';
import { QuizQuestion } from '../types';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface QuizComponentProps {
  questions: QuizQuestion[];
  onComplete: () => void;
}

const QuizComponent: React.FC<QuizComponentProps> = ({ questions, onComplete }) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const currentQuestion = questions[currentQIndex];

  const handleOptionClick = (optionId: string) => { if (isAnswered) return; setSelectedOption(optionId); };
  const handleSubmit = () => {
    if (!selectedOption) return;
    const isCorrect = currentQuestion.options.find(o => o.id === selectedOption)?.isCorrect;
    if (isCorrect) setScore(s => s + 1);
    setIsAnswered(true);
  };
  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1); setSelectedOption(null); setIsAnswered(false);
    } else { setCompleted(true); onComplete(); }
  };

  if (completed) {
    return (
      <div className="p-8 bg-white rounded-3xl text-center border border-slate-100 shadow-sm">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><AwardIcon score={score} total={questions.length} /></div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Quiz Concluído!</h3>
        <p className="text-slate-500 mb-6 font-medium">Você acertou {score} de {questions.length}</p>
        <div className="w-full bg-[#E5E5EA] rounded-full h-3 mb-6 overflow-hidden">
            <div className="bg-[#007AFF] h-3 rounded-full transition-all duration-1000" style={{ width: `${(score / questions.length) * 100}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm mt-4 relative">
      <span className="absolute top-6 right-8 text-xs font-bold text-slate-300 uppercase tracking-widest">Q{currentQIndex + 1}/{questions.length}</span>
      <h4 className="text-xl font-bold text-slate-900 mb-8 pr-12 leading-snug">{currentQuestion.question}</h4>

      <div className="space-y-3">
        {currentQuestion.options.map((option) => {
          let optionClass = "w-full p-4 md:p-5 text-left rounded-2xl border-2 transition-all duration-200 flex items-center justify-between font-medium text-[15px] tap-scale ";
          if (isAnswered) {
             if (option.isCorrect) optionClass += "bg-green-50 border-green-500 text-green-700 shadow-sm";
             else if (selectedOption === option.id) optionClass += "bg-red-50 border-red-500 text-red-700 shadow-sm";
             else optionClass += "bg-[#F2F2F7] border-transparent text-slate-400 opacity-50";
          } else {
             if (selectedOption === option.id) optionClass += "bg-blue-50 border-[#007AFF] text-[#007AFF] shadow-md ring-2 ring-blue-100";
             else optionClass += "bg-white border-[#E5E5EA] hover:bg-[#F2F2F7] text-slate-700";
          }
          return (
            <button key={option.id} onClick={() => handleOptionClick(option.id)} disabled={isAnswered} className={optionClass}>
              <span>{option.text}</span>
              {isAnswered && option.isCorrect && <CheckCircle className="w-6 h-6 text-green-600 fill-green-100" />}
              {isAnswered && !option.isCorrect && selectedOption === option.id && <XCircle className="w-6 h-6 text-red-600 fill-red-100" />}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-end">
        {!isAnswered ? (
          <button onClick={handleSubmit} disabled={!selectedOption} className="px-8 py-3 bg-[#007AFF] text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95">Responder</button>
        ) : (
          <button onClick={handleNext} className="px-8 py-3 bg-slate-900 text-white rounded-full hover:bg-black font-bold shadow-lg transition-all active:scale-95">
            {currentQIndex < questions.length - 1 ? "Próxima" : "Finalizar"}
          </button>
        )}
      </div>
    </div>
  );
};

const AwardIcon = ({score, total}: {score:number, total:number}) => {
    return <div className="text-2xl font-black text-blue-500">{Math.round((score/total)*100)}%</div>;
}

export default QuizComponent;