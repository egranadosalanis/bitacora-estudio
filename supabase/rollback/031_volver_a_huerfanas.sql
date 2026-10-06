-- Rollback de 031: restaura las asignaturas y entradas borradas desde las copias.
insert into public.asignaturas select * from public.asignaturas_backup_031 on conflict (id) do nothing;
insert into public.entradas_estudio select * from public.entradas_estudio_backup_031 on conflict (id) do nothing;
