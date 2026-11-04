-- Fase 7: agregado familiar e contas partilhadas.
-- Correr uma vez no SQL Editor do Supabase (projeto financas).

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- A coluna tem de existir antes das funções que a usam.
alter table public.accounts
  add column household_id uuid references public.households(id) on delete set null;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create or replace function public.is_household_member(p_household uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_use_account(p_account uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.accounts a
    where a.id = p_account
      and (a.owner_id = auth.uid()
           or (a.household_id is not null and public.is_household_member(a.household_id)))
  );
$$;

revoke execute on function public.is_household_member(uuid) from public;
revoke execute on function public.can_use_account(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_use_account(uuid) to authenticated;

create policy households_select_member on public.households for select
  using (public.is_household_member(id));

create policy household_members_select_member on public.household_members for select
  using (user_id = auth.uid() or public.is_household_member(household_id));

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Tens de iniciar sessão.';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Já fazes parte de um grupo familiar.';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_id;

  insert into public.household_members (household_id, user_id)
  values (new_id, auth.uid());

  return new_id;
end;
$$;

create or replace function public.add_household_member(p_household uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  found_user uuid;
  found_name text;
begin
  if not public.is_household_member(p_household) then
    raise exception 'Só os membros do grupo podem convidar pessoas.';
  end if;

  select u.id into found_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if found_user is null then
    raise exception 'Não existe nenhum utilizador com esse email. A pessoa tem de criar conta na app primeiro.';
  end if;

  insert into public.household_members (household_id, user_id)
  values (p_household, found_user)
  on conflict do nothing;

  select p.display_name into found_name from public.profiles p where p.id = found_user;
  return coalesce(found_name, trim(p_email));
end;
$$;

revoke execute on function public.create_household(text) from public;
revoke execute on function public.add_household_member(uuid, text) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.add_household_member(uuid, text) to authenticated;

create policy profiles_select_household on public.profiles for select
  using (exists (
    select 1
    from public.household_members me
    join public.household_members other on other.household_id = me.household_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  ));

drop policy accounts_select_own on public.accounts;
drop policy accounts_insert_own on public.accounts;
drop policy accounts_update_own on public.accounts;

create policy accounts_select_visible on public.accounts for select
  using (owner_id = auth.uid() or (household_id is not null and public.is_household_member(household_id)));

create policy accounts_insert_own on public.accounts for insert
  with check (owner_id = auth.uid() and (household_id is null or public.is_household_member(household_id)));

create policy accounts_update_own on public.accounts for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (household_id is null or public.is_household_member(household_id)));

drop policy transactions_select_own on public.transactions;
drop policy transactions_insert_own on public.transactions;
drop policy transactions_update_own on public.transactions;

create policy transactions_select_visible on public.transactions for select
  using (
    owner_id = auth.uid()
    or public.can_use_account(account_id)
    or (to_account_id is not null and public.can_use_account(to_account_id))
  );

create policy transactions_insert_own on public.transactions for insert
  with check (
    owner_id = auth.uid()
    and public.can_use_account(account_id)
    and (to_account_id is null or public.can_use_account(to_account_id))
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = category_id and (c.owner_id is null or c.owner_id = auth.uid())
    ))
  );

create policy transactions_update_own on public.transactions for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.can_use_account(account_id)
    and (to_account_id is null or public.can_use_account(to_account_id))
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = category_id and (c.owner_id is null or c.owner_id = auth.uid())
    ))
  );
