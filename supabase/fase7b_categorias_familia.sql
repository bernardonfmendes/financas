-- Categorias do proprietário, com partilha pelo grupo familiar.
-- Correr uma vez no SQL Editor do Supabase (projeto financas), depois da fase7_familia_contas_partilhadas.sql.

-- As categorias predefinidas passam a ser da conta principal, para poderem ser editadas.
update public.categories
set owner_id = (select id from auth.users where email = 'bernardo.n.f.mendes@gmail.com')
where owner_id is null;

-- Categorias utilizáveis: as próprias ou as de um membro do mesmo grupo familiar.
create or replace function public.can_use_category(p_category uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.categories c
    where c.id = p_category
      and (c.owner_id is null
           or c.owner_id = auth.uid()
           or exists (
             select 1 from public.household_members a
             join public.household_members b on b.household_id = a.household_id
             where a.user_id = auth.uid() and b.user_id = c.owner_id
           ))
  );
$$;

revoke execute on function public.can_use_category(uuid) from public;
grant execute on function public.can_use_category(uuid) to authenticated;

create policy categories_select_household on public.categories for select
  using (exists (
    select 1 from public.household_members a
    join public.household_members b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = categories.owner_id
  ));

drop policy transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions for insert
  with check (
    owner_id = auth.uid()
    and public.can_use_account(account_id)
    and (to_account_id is null or public.can_use_account(to_account_id))
    and (category_id is null or public.can_use_category(category_id))
  );

drop policy transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.can_use_account(account_id)
    and (to_account_id is null or public.can_use_account(to_account_id))
    and (category_id is null or public.can_use_category(category_id))
  );

drop policy budgets_insert_own on public.budgets;
create policy budgets_insert_own on public.budgets for insert
  with check (owner_id = auth.uid() and public.can_use_category(category_id));

drop policy budgets_update_own on public.budgets;
create policy budgets_update_own on public.budgets for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.can_use_category(category_id));

drop policy recurring_rules_insert_own on public.recurring_rules;
create policy recurring_rules_insert_own on public.recurring_rules for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid())
    and (category_id is null or public.can_use_category(category_id))
  );

drop policy recurring_rules_update_own on public.recurring_rules;
create policy recurring_rules_update_own on public.recurring_rules for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid())
    and (category_id is null or public.can_use_category(category_id))
  );

drop policy category_preferences_insert_own on public.category_preferences;
create policy category_preferences_insert_own on public.category_preferences for insert
  with check (owner_id = auth.uid() and public.can_use_category(category_id));

drop policy category_preferences_update_own on public.category_preferences;
create policy category_preferences_update_own on public.category_preferences for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.can_use_category(category_id));
