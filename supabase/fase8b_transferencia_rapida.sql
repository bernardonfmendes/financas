-- Transferência rápida entre contas (por exemplo, pôr dinheiro na Poupança), pelos nomes das contas.
-- Correr uma vez no SQL Editor do Supabase (projeto financas).

create or replace function public.registar_transferencia_rapida(
  p_amount_cents bigint,
  p_origem text,
  p_destino text,
  p_descricao text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from uuid;
  v_to uuid;
begin
  select a.id into v_from
  from public.accounts a
  where lower(a.name) = lower(trim(p_origem))
    and public.can_use_account(a.id)
  limit 1;

  if v_from is null then
    raise exception 'Conta de origem não encontrada: %', p_origem;
  end if;

  select a.id into v_to
  from public.accounts a
  where lower(a.name) = lower(trim(p_destino))
    and public.can_use_account(a.id)
  limit 1;

  if v_to is null then
    raise exception 'Conta de destino não encontrada: %', p_destino;
  end if;

  if v_from = v_to then
    raise exception 'A conta de origem e a de destino têm de ser diferentes.';
  end if;

  insert into public.transactions (
    kind, amount_cents, account_id, to_account_id, category_id, occurred_at,
    description, tags, status
  ) values (
    'transferencia',
    p_amount_cents,
    v_from,
    v_to,
    null,
    now(),
    coalesce(nullif(trim(p_descricao), ''), 'Poupança'),
    '{}',
    'paga'
  );
end;
$$;

revoke execute on function public.registar_transferencia_rapida(bigint, text, text, text) from public;
grant execute on function public.registar_transferencia_rapida(bigint, text, text, text) to authenticated;
