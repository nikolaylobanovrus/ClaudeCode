-- Миграция: защищённое хранилище документов клиентов (bucket client-docs).
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- Зачем: письма с вложениями от почтового сервиса форм терялись (текстовые
-- доставляются, с файлами — нет). Теперь клиент загружает файлы со страницы
-- «Подготовить документы» в этот bucket, а письмо оператору уходит текстовым
-- со списком загруженных файлов. Оператор скачивает файлы в кабинете /operator.
--
-- Права:
--  - роль anon (посетители сайта): ТОЛЬКО загрузка (insert). Ни чтения, ни
--    списка, ни перезаписи — паспорта и справки недоступны снаружи;
--  - роль authenticated (оператор, вход по email/паролю): чтение и список.

insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', false)
on conflict (id) do nothing;

drop policy if exists "anon upload client docs" on storage.objects;
create policy "anon upload client docs"
  on storage.objects for insert to anon
  with check (bucket_id = 'client-docs');

drop policy if exists "operator read client docs" on storage.objects;
create policy "operator read client docs"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-docs');
