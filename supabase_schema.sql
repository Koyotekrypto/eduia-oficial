-- EXECUTE ESTE SCRIPT NO EDITOR SQL DO SUPABASE

-- Tabela 1: Usuários
create table if not exists profiles (
  id text primary key, -- Changed from uuid to text to support Clerk IDs (e.g. user_2p...)
  clerk_id text unique, -- Redundant if ID is Clerk ID, but keeping for safety
  email text unique,
  name text,
  avatar_url text,
  nivel_ensino text,
  estilos_aprendizagem text[],
  assuntos_favoritos text[],
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Tabela 2: Planos de Aula
create table if not exists planos_aula (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles(id) on delete cascade, -- Changed to text
  titulo text not null,
  assunto text not null,
  modulos jsonb not null,
  progresso int default 0,
  tempo_gasto int default 0,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Tabela 3: Progresso e Badges
create table if not exists progresso (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles(id) on delete cascade,
  plano_id uuid references planos_aula(id) on delete cascade,
  modulo_atual int,
  quiz_scores jsonb,
  badges text[],
  xp_total int default 0,
  updated_at timestamp default now()
);

-- Tabela 4: Histórico de Conversas com a Aria
create table if not exists conversas_aria (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles(id) on delete cascade,
  plano_id uuid references planos_aula(id),
  mensagens jsonb not null,
  created_at timestamp default now()
);

-- Habilitar RLS
alter table profiles enable row level security;
alter table planos_aula enable row level security;
alter table progresso enable row level security;
alter table conversas_aria enable row level security;

-- Políticas de Segurança (Simplificadas para permitir Leitura/Escrita do próprio usuário)
-- Nota: auth.uid() funciona se houver integração JWT Clerk-Supabase.
-- Caso contrário, a lógica de aplicação deve garantir o filtro.

create policy "Users can view own profile" 
  on profiles for select 
  using ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

create policy "Users can insert own profile" 
  on profiles for insert 
  with check ( auth.uid() = id );

-- Planos
create policy "Users can view own plans" 
  on planos_aula for select 
  using ( auth.uid() = user_id );

create policy "Users can insert own plans" 
  on planos_aula for insert 
  with check ( auth.uid() = user_id );

create policy "Users can update own plans" 
  on planos_aula for update 
  using ( auth.uid() = user_id );

-- Repetir logica para outras tabelas conforme necessidade
