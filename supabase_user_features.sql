-- Correr en Supabase SQL Editor: https://supabase.com/dashboard/project/hwhabwsjnzpmpdkwonnj/sql

create table if not exists public.user_features (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  email      text,
  features   jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table public.user_features enable row level security;

-- Usuarios leen solo su fila; admin lee todas
create policy "select_features" on public.user_features
  for select using (
    auth.uid() = user_id
    or auth.email() = 'danieeelr10@gmail.com'
  );

-- Solo admin puede actualizar cualquier fila
create policy "admin_update_features" on public.user_features
  for update using (auth.email() = 'danieeelr10@gmail.com');

-- Cada usuario crea su propia fila al registrarse
create policy "insert_own_features" on public.user_features
  for insert with check (auth.uid() = user_id);
