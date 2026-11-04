-- Atalho por nomes: listas atuais e registo de despesas sem identificadores fixos.
-- Correr uma vez no SQL Editor do Supabase (projeto financas).

-- Lista das categorias de despesa que o utilizador pode usar, pela ordem escolhida na app.
create or replace function public.lista_categorias_despesa()
returns text[]
language sql
security invoker
stable
set search_path = public
as $$
  select coalesce(array_agg(c.name order by coalesce(p.sort_order, 1000), c.name), '{}')
  from public.categories c
  left join public.category_preferences p
    on p.category_id = c.id and p.owner_id = auth.uid()
  where c.kind = 'despesa'
    and public.can_use_category(c.id);
$$;

-- Lista das contas que o utilizador pode usar, pela ordem de criação.
create or replace function public.lista_contas()
returns text[]
language sql
security invoker
stable
set search_path = public
as $$
  select coalesce(array_agg(a.name order by a.created_at), '{}')
  from public.accounts a
  where public.can_use_account(a.id);
$$;

-- Regista uma despesa usando os nomes escolhidos no atalho.
create or replace function public.registar_despesa_rapida(
  p_amount_cents bigint,
  p_categoria text,
  p_conta text,
  p_metodo text,
  p_descricao text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account uuid;
  v_category uuid;
begin
  select a.id into v_account
  from public.accounts a
  where lower(a.name) = lower(trim(p_conta))
    and public.can_use_account(a.id)
  limit 1;

  if v_account is null then
    raise exception 'Conta não encontrada: %', p_conta;
  end if;

  select c.id into v_category
  from public.categories c
  where c.kind = 'despesa'
    and lower(c.name) = lower(trim(p_categoria))
    and public.can_use_category(c.id)
  limit 1;

  if v_category is null then
    raise exception 'Categoria não encontrada: %', p_categoria;
  end if;

  insert into public.transactions (
    kind, amount_cents, account_id, category_id, occurred_at,
    description, payment_method, tags, status
  ) values (
    'despesa',
    p_amount_cents,
    v_account,
    v_category,
    now(),
    coalesce(nullif(trim(p_descricao), ''), p_categoria),
    nullif(lower(trim(p_metodo)), ''),
    '{}',
    'paga'
  );
end;
$$;

revoke execute on function public.lista_categorias_despesa() from public;
revoke execute on function public.lista_contas() from public;
revoke execute on function public.registar_despesa_rapida(bigint, text, text, text, text) from public;
grant execute on function public.lista_categorias_despesa() to authenticated;
grant execute on function public.lista_contas() to authenticated;
grant execute on function public.registar_despesa_rapida(bigint, text, text, text, text) to authenticated;
