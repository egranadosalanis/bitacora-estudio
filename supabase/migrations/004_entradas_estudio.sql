-- ============================================================
-- Migración: entradas de estudio individuales.
--
-- Hasta ahora `registros_estudio` guarda UN total por día y asignatura
-- (unique asignatura_id + fecha) y cada "Guardar" lo sobrescribe — dos
-- dispositivos se pisan. A partir de aquí cada pulsación de "Guardar"
-- es una fila nueva en `entradas_estudio`, y el total de un día o
-- asignatura es siempre la suma de sus entradas.
--
-- ES SOLO ADITIVA: crea una tabla nueva y copia en ella cada fila de
-- registros_estudio. NO modifica ni borra registros_estudio (ni ninguna
-- otra tabla); esa tabla se queda tal cual hasta que se decida retirarla.
--
-- ES IDEMPOTENTE: cada entrada copiada guarda el id de su fila original
-- (legacy_registro_id, único), así que ejecutar este archivo dos o más
-- veces no duplica nada — solo copia las filas antiguas que todavía no
-- estén copiadas (útil para volver a ejecutarlo justo antes de fusionar
-- con main, y así traer lo que se haya guardado entretanto con la app
-- vieja).
--
-- Ejecutar en el SQL Editor de Supabase (Run), DESPUÉS de haber hecho la
-- copia de seguridad. Luego ejecutar supabase/verificaciones/004_verificar_entradas.sql.
-- ============================================================

create table if not exists public.entradas_estudio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asignatura_id uuid not null references public.asignaturas(id) on delete cascade,
  -- Día (local del usuario) al que cuentan los minutos.
  fecha date not null,
  minutos integer not null check (minutos > 0),
  -- Momento en que se pulsó "Guardar".
  created_at timestamptz not null default now(),
  -- Identificador anónimo del dispositivo que la guardó ('migracion' para
  -- las copiadas desde registros_estudio).
  device_id text,
  -- id de la fila de registros_estudio de la que viene (solo en las
  -- migradas). Es lo que hace idempotente la copia.
  legacy_registro_id uuid unique
);

create index if not exists idx_entradas_user on public.entradas_estudio(user_id);
create index if not exists idx_entradas_user_fecha on public.entradas_estudio(user_id, fecha);

-- ---------- Row Level Security ----------
-- Igual que registros_estudio: cada usuario solo ve/crea/edita/borra sus
-- propias filas. Además, al crear o editar se exige que la asignatura
-- también sea suya (no se puede colgar una entrada de una asignatura ajena).
alter table public.entradas_estudio enable row level security;

drop policy if exists "entradas_all_own" on public.entradas_estudio;
create policy "entradas_all_own" on public.entradas_estudio
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.asignaturas a
      where a.id = asignatura_id and a.user_id = auth.uid()
    )
  );

-- ---------- Copia de los registros antiguos ----------
-- Cada fila antigua (fecha + asignatura + minutos) pasa a ser UNA entrada
-- con los mismos minutos, del mismo usuario. Las que ya estén copiadas se
-- saltan (on conflict do nothing).
insert into public.entradas_estudio
  (user_id, asignatura_id, fecha, minutos, created_at, device_id, legacy_registro_id)
select r.user_id, r.asignatura_id, r.fecha, r.minutos, r.created_at, 'migracion', r.id
from public.registros_estudio r
on conflict (legacy_registro_id) do nothing;
