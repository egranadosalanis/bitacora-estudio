-- Rollback de la migración 036: quita las restricciones de año académico y de solape de cursos.
alter table public.cursos drop constraint if exists cursos_ano_academico;
alter table public.cursos drop constraint if exists cursos_sin_solape;
