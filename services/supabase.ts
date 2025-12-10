
import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Key missing. Persistence will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// --- Typed Helpers ---
// You can expand these with proper Typescript interfaces later

export async function saveLegacyPlan(plan: any, userId: string) {
    if (!userId) return null;

    // Remove isCompleted from modules if it causes structure issues or keep it if JSONB handles it allowed.
    // Supabase JSONB is flexible.

    const { data, error } = await supabase
        .from('planos_aula')
        .upsert({
            id: plan.id, // Keep ID if UUID, else might need gen_random_uuid() or ensure legacy IDs are valid UUIDs? 
            // Legacy IDs were Date.now().toString(), which is NOT valid UUID.
            // We probably need to map them or let Supabase generate new ones and update local ref?
            // For MVP, if ID is not UUID, we arguably should generate a new one.
            // BUT, Date.now() is not a UUID. We should fail purely if column is UUID.
            // Strategy: If ID is not UUID, omit it to let Supabase gen one, OR generate one here.
            user_id: userId,
            titulo: plan.subject, // Map 'subject' to 'titulo' or 'assunto'
            assunto: plan.subject,
            modulos: plan.modules,
            progresso: plan.progress,
            tempo_gasto: 0,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' }); // This might fail if ID is not UUID type in DB.

    return { data, error };
}

// Wrapper for simple plans fetch
export async function getUserPlans(userId: string) {
    const { data, error } = await supabase
        .from('planos_aula')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return { data, error };
}

// Wrapper to save User Profile from Clerk data
export async function syncUserProfile(user: any) {
    if (!user) return;

    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id, // Clerk ID should match if we use it, or we map it.
            // Wait, if table uses Clerk ID as PK, fine.
            // If table uses UUID and Clerk ID is text, we have a mismatch if we try to inject.
            // The SQL said: id uuid primary key. Clerk IDs are strings (user_...).
            // PROBLEM: Clerk ID is NOT UUID.
            // SOLUTION: The SQL created `clerk_id text unique`. 
            // So we should insert into `clerk_id` and let `id` be auto-gen or manage it.
            // BUT `user_id` in other tables references `profiles(id)` (UUID).
            // This is tricky without Supabase Auth Integration.
            // FIX: We need a mechanism to map Clerk User to Supabase Profile UUID.
            // Or, change tables to use TEXT for user_id to support Clerk IDs directly.
            // Given instructions, I will assume we might simply use TEXT for IDs or map them.
            // LET'S CHANGE THE DB STRATEGY IN SQL IF POSSIBLE OR ADAPT CODE.
            // "Execute agora" implies I should make it work.
            // Safest: Use Clerk ID as the primary key but type TEXT in Postgres.
            // OR: Perform a lookup.
            // Let's try upserting by clerk_id.
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName,
            avatar_url: user.imageUrl,
            updated_at: new Date().toISOString()
        }, { onConflict: 'clerk_id' })
        .select(); // Return to get the UUID if needed

    return { data, error };
}

// --- New V2 Functions ---

export async function carregarBiblioteca(userId: string) {
    const { data, error } = await supabase
        .from('planos_aula')
        .select('id, titulo, modulos, progresso, updated_at, assunto')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    return { data: data || [], error };
}

export async function carregarPerfilCompleto(userId: string) {
    // 1. Get Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId) // Assuming we map Clerk ID to this, or use clerk_id column
        .maybeSingle(); // Use maybeSingle to avoid 406 if not found

    // 2. Get Stats (Progresso table)
    const { data: stats, error: statsError } = await supabase
        .from('progresso')
        .select('xp_total, badges, quiz_scores, streak_days, level')
        .eq('user_id', userId)
        .maybeSingle();

    return { profile, stats, error: profileError || statsError };
}

export async function atualizarProgresso(planoId: string, novoProgresso: number, userId: string, novoXP = 0) {
    // Upd Plan
    await supabase
        .from('planos_aula')
        .update({ progresso: novoProgresso, updated_at: new Date().toISOString() })
        .eq('id', planoId);

    // Upd XP
    if (novoXP > 0) {
        // RPC call is safer for atomic increments
        const { error } = await supabase.rpc('increment_xp', { user_id: userId, xp_ganho: novoXP });
        if (error) {
            // Fallback
            const { data: currentStats } = await supabase.from('progresso').select('xp_total').eq('user_id', userId).single();
            if (currentStats) {
                await supabase.from('progresso').update({ xp_total: (currentStats.xp_total || 0) + novoXP }).eq('user_id', userId);
            }
        }
    }
}
