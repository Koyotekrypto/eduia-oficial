export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  explanation: string;
}

export interface Module {
  id: string;
  title: string;
  content: string;
  visualKeyword: string;
  generatedImage?: string;
  quiz: QuizQuestion[];
  isCompleted: boolean;
}

export interface LessonPlan {
  id: string;
  subject: string;
  createdAt: string;
  modules: Module[];
  progress: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or Icon name
  unlockedAt?: string;
}

export interface AriaReport {
  id: string;
  date: string;
  summary: string; // Textual summary
  audioUrl?: string; // TTS generated audio (mocked)
  score: number;
}

export interface EvolutionStats {
  totalXp: number;
  level: number;
  streakDays: number;
  modulesCompleted: number;
  quizzesTaken: number;
  averageScore: number;
  subjectMastery: Record<string, number>; // e.g., { "Math": 80, "History": 40 }
}

export interface UserPreferences {
  educationLevel: 'fundamental_1' | 'fundamental_2' | 'medio' | 'superior' | 'profissional' | string;
  proficiency: 'basico' | 'intermediario' | 'avancado' | 'academico'; 
  learningStyle: 'visual' | 'auditivo' | 'leitura' | 'cinestesico' | string;
  favoriteSubjects: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'email';
  googleId?: string;
  joinDate: string;
  onboardingCompleted: boolean;
  preferences: UserPreferences;
  evolution: EvolutionStats;
  badges: Badge[];
  reports: AriaReport[];
}

export type ViewState = 'dashboard' | 'planner' | 'library' | 'profile';