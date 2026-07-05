-- Миграция: право оператора удалять файлы и клиентов.
-- Применение: Supabase → SQL Editor → New query → вставить целиком → Run.
-- Безопасно выполнять повторно.
--
-- Даёт роли authenticated (оператор, вход по email/паролю в /operator):
--  - удаление файлов из хранилища client-docs (кнопки «Удалить все файлы»
--    и «Удалить клиента» в кабинете) — чтобы чистить хранилище после
--    сдачи декларации и не упираться в лимит 1 ГБ бесплатного тарифа;
--  - удаление записей из таблицы clients (кнопка «Удалить клиента»).
-- Роль anon (посетители сайта) удалять по-прежнему ничего не может.

drop policy if exists "operator delete client docs" on storage.objects;
create policy "operator delete client docs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-docs');

drop policy if exists "operator delete clients" on public.clients;
create policy "operator delete clients"
  on public.clients for delete to authenticated
  using (true);
