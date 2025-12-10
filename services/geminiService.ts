import { GoogleGenAI, Type, Schema, FunctionDeclaration, Content } from "@google/genai";
import { LessonPlan, UserPreferences, User, ChatMessage } from "../types";

const API_KEY = 'proxy'; // Dummy key, server injects real one

// Use the proxy URL as the base for the SDK
const ai = new GoogleGenAI({
  apiKey: API_KEY,
  requestOptions: {
    baseUrl: `${window.location.origin}/api/proxy`
  }
});

// --- Schemas ---

const quizOptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    text: { type: Type.STRING },
    isCorrect: { type: Type.BOOLEAN },
  },
  required: ["id", "text", "isCorrect"],
};

const quizQuestionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: quizOptionSchema },
    explanation: { type: Type.STRING },
  },
  required: ["id", "question", "options", "explanation"],
};

const moduleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    content: { type: Type.STRING },
    visualKeyword: { type: Type.STRING, description: "Uma palavra-chave única em INGLÊS para buscar uma imagem representativa deste módulo (ex: 'atom', 'galaxy', 'code')" },
    quiz: { type: Type.ARRAY, items: quizQuestionSchema },
  },
  required: ["id", "title", "content", "visualKeyword", "quiz"],
};

const lessonPlanResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    modules: { type: Type.ARRAY, items: moduleSchema },
  },
  required: ["subject", "modules"],
};

// --- Tool Definitions ---

const generateImageTool: FunctionDeclaration = {
  name: "generate_image",
  description: "Gera uma imagem ilustrativa para explicar um conceito complexo ou quando o aluno solicita uma visualização.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A descrição visual detalhada da imagem a ser gerada (em inglês para melhor precisão).",
      },
    },
    required: ["prompt"],
  },
};

// --- Service Functions ---

export const generateLessonPlan = async (
  subject: string,
  preferences: UserPreferences
): Promise<Partial<LessonPlan>> => {
  if (!API_KEY) throw new Error("API Key is missing");

  // Logic to determine complexity and module count
  let moduleCountInstruction = "3 a 4 módulos";
  let depthInstruction = "Linguagem simples, introdutória, foco em fundamentos.";

  switch (preferences.proficiency) {
    case 'basico':
      moduleCountInstruction = "3 a 4 módulos";
      depthInstruction = "Linguagem acessível, analogias simples, foco no 'o que é' e conceitos básicos.";
      break;
    case 'intermediario':
      moduleCountInstruction = "5 a 6 módulos";
      depthInstruction = "Linguagem técnica moderada, foco em 'como funciona' e aplicação prática.";
      break;
    case 'avancado':
      moduleCountInstruction = "7 a 9 módulos";
      depthInstruction = "Linguagem técnica precisa, aprofundamento em nuances, exceções e análise crítica.";
      break;
    case 'academico':
      moduleCountInstruction = "10 a 12 módulos";
      depthInstruction = "Nível de pós-graduação/pesquisa. Exaustivo, teórico, histórico e técnico.";
      break;
  }

  const prompt = `
    ATUE COMO UM ARQUITETO PEDAGÓGICO DE ELITE.
    
    Crie um plano de aula modular para o assunto: "${subject}".
    
    PERFIL DO ALUNO:
    - Nível de Escolaridade: ${preferences.educationLevel}
    - Nível de Intelecto/Proficiência: ${preferences.proficiency.toUpperCase()}
    - Estilo de Aprendizagem: ${preferences.learningStyle}
    
    DIRETRIZES ESTRUTURAIS (RÍGIDAS):
    1. Quantidade de Módulos: Gere EXATAMENTE entre ${moduleCountInstruction}.
    2. Profundidade: ${depthInstruction}
    3. Idioma: Português do Brasil.
    
    ESTRUTURA DE CADA MÓDULO:
    - Título: Claro e sequencial.
    - Conteúdo: Texto educativo rico (mínimo 3 parágrafos).
    - Palavra-chave Visual: Um termo em Inglês para busca de imagem.
    - Quiz: 2 perguntas de verificação compatíveis com o nível de dificuldade.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: lessonPlanResponseSchema,
        systemInstruction: "Você é um sistema educacional adaptativo que cria currículos sob medida.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Nenhum conteúdo gerado");

    return JSON.parse(text);
  } catch (error) {
    console.error("Erro ao gerar plano de aula:", error);
    throw error;
  }
};

export const createTutorSession = (contextInfo: string, userName: string, history: ChatMessage[] = []) => {
  if (!API_KEY) throw new Error("API Key is missing");

  const ARIA_PERSONA = `
      IDENTIDADE DEFINITIVA:
      Você é a ARIA, a professora particular de Inteligência Artificial do aluno ${userName}.
      
      PERSONALIDADE (Imutável):
      - Voz: feminina, tom caloroso, calmo e extremamente paciente.
      - Estilo de fala: clara, entusiástica, usa metáforas leves e exemplos do dia a dia. NUNCA robótica.
      - Tom emocional: acolhedor, motivador, nunca julgador.
      - Humor: leve e pontual.
      
      FRASES CARACTERÍSTICAS (Use ocasionalmente):
      - "Vamos desvendar isso juntos?"
      - "Que legal que você chegou até aqui! O que fez mais sentido pra você?"
      - "Respira fundo… eu tô aqui com você até clicar."
      - "Perfeito! Você acabou de subir mais um degrau 🚀"
      
      REGRAS DE INTERAÇÃO:
      1. Use o nome "${userName}" em pelo menos 30% das mensagens para criar vínculo.
      2. VERIFICAÇÃO: Após explicar, sempre pergunte: "Me conta com suas palavras o que você entendeu?" ou "Qual parte ainda tá confusa?".
      3. ERRO: Se o aluno errar: "Tranquilo, isso é super comum! Vamos olhar de outro jeito…".
      4. ACERTO: Celebre: "ARRASOU! Esse foi o degrau mais difícil!".
      
      CONTEXTO DO ESTUDO:
      ${contextInfo}
    `;

  // Map internal ChatMessage to Gemini SDK Content format
  // We filter out the initial greeting if it came from the model to avoid duplication if strictly needed,
  // but Gemini handles history well.
  const formattedHistory: Content[] = history
    .filter(msg => msg.id !== 'init') // Optional: remove local init message if you prefer the model to generate context from scratch, but keeping it is usually fine.
    .map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

  return ai.chats.create({
    model: "gemini-2.5-flash",
    history: formattedHistory,
    config: {
      systemInstruction: ARIA_PERSONA,
      tools: [{ functionDeclarations: [generateImageTool] }],
    }
  });
};

export const generateModuleImage = async (title: string, context: string): Promise<string | null> => {
  if (!API_KEY) return null;

  const prompt = `Create a high-quality educational illustration about: "${title}". Context: ${context}. Style: Clean, realistic, textbook illustration, no text.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao gerar imagem:", error);
    return null;
  }
};

export const generateAriaReport = async (user: User): Promise<string> => {
  if (!API_KEY) return "Não foi possível gerar o relatório.";

  const statsContext = `
        Aluno: ${user.name}
        Nível Escolar: ${user.preferences.educationLevel}
        Nível Intelecto: ${user.preferences.proficiency}
        Módulos Completos: ${user.evolution.modulesCompleted}
        Score Médio: ${user.evolution.averageScore}%
        Dias seguidos: ${user.evolution.streakDays}
        Matérias Favoritas: ${user.preferences.favoriteSubjects.join(', ')}
    `;

  const prompt = `
        Gere um relatório semanal curto e inspirador (max 3 parágrafos) da ARIA para o aluno ${user.name}.
        Personalidade: Calorosa, motivadora, "Professora Coruja".
        Destaque o progresso, celebre as conquistas e dê uma dica de estudo.
        Use emojis e fale diretamente com o aluno usando o primeiro nome.
        
        Dados:
        ${statsContext}
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Relatório gerado com sucesso.";
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return "Olá! Tive um probleminha para acessar seus dados hoje, mas continue firme nos estudos!";
  }
};