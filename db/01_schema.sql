-- Ejecutar en Supabase > SQL Editor > New query > Run

create table if not exists establecimientos (
  id             bigint generated always as identity primary key,
  refes          text,                      -- código REFES/SISA (cnr), si existe
  nombre         text not null,
  tipo           text not null default 'establecimiento', -- 'establecimiento' | 'farmacia'
  categoria      text,                      -- cat: hospital, CAPS, etc.
  modalidad      text,                      -- mod
  especialidad   text,                      -- esp
  financiamiento text,                      -- tes
  guardia        boolean not null default false,  -- calculado por el script (ver README)
  partido        text,
  localidad      text,
  direccion      text,
  telefono       text,
  latitud        double precision not null,
  longitud       double precision not null,
  fuente         text,
  actualizado    timestamptz default now()
);

create index if not exists idx_estab_partido on establecimientos (partido);
create index if not exists idx_estab_tipo on establecimientos (tipo);
create index if not exists idx_estab_guardia on establecimientos (guardia);

-- Turnos de farmacias (segunda etapa, queda preparada)
create table if not exists turnos (
  id                 bigint generated always as identity primary key,
  establecimiento_id bigint references establecimientos(id) on delete cascade,
  desde              timestamptz not null,
  hasta              timestamptz not null,
  fuente             text
);
create index if not exists idx_turnos_rango on turnos (desde, hasta);

-- Seguridad: la clave pública (anon) solo puede LEER
alter table establecimientos enable row level security;
alter table turnos enable row level security;

drop policy if exists "lectura publica establecimientos" on establecimientos;
create policy "lectura publica establecimientos"
  on establecimientos for select using (true);

drop policy if exists "lectura publica turnos" on turnos;
create policy "lectura publica turnos"
  on turnos for select using (true);
