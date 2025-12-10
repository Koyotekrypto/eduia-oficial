
import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { X } from 'lucide-react';

interface LoginModalProps {
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-white/20">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-slate-100/50 backdrop-blur-md rounded-full hover:bg-slate-200 transition-colors"
                >
                    <X className="w-5 h-5 text-slate-500" />
                </button>
                <div className="p-8 pb-2 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo ao EduIA</h2>
                    <p className="text-slate-500 mb-4 text-sm">Entre para salvar seu progresso e conversar com a Aria.</p>
                </div>
                <div className="flex justify-center pb-8 px-4">
                    <SignIn
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "shadow-none border-none w-full",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden",
                                socialButtonsBlockButton: "rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold",
                                formButtonPrimary: "bg-[#007AFF] hover:bg-blue-600 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20",
                                footer: "hidden"
                            }
                        }}
                        signUpUrl="/sign-up" // Optional if we want separate sign up logic, but SignIn handles it strictly speaking usually
                    />
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
