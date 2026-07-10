-- ============================================================
-- İSG TEST PLATFORMU - SUPABASE ŞEMASI
-- Bu dosyayı Supabase projenizde SQL Editor'e yapıştırıp çalıştırın.
-- ============================================================

-- 1. İLLER (YEDAŞ'ın hizmet verdiği 5 il, sabit liste)
create table if not exists provinces (
  id bigint generated always as identity primary key,
  name text not null unique
);

insert into provinces (name) values
  ('Samsun'), ('Ordu'), ('Çorum'), ('Amasya'), ('Sinop')
on conflict (name) do nothing;

-- 2. DEPARTMANLAR
create table if not exists departments (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- Örnek departmanlar - kendi organizasyon yapınıza göre düzenleyin
insert into departments (name) values
  ('İnsan Kaynakları'),
  ('Elektrik Dağıtım İşletme'),
  ('Bilgi Teknolojileri'),
  ('Muhasebe ve Finans'),
  ('Saha Operasyonları'),
  ('İş Sağlığı ve Güvenliği'),
  ('Müşteri Hizmetleri'),
  ('Teknik İşler')
on conflict (name) do nothing;

-- 3. SORU HAVUZU
create table if not exists questions (
  id bigint generated always as identity primary key,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  is_active boolean not null default true,
  frequency_weight int not null default 2 check (frequency_weight in (1,2,3)),
  created_at timestamptz not null default now()
);

-- Mevcut (daha önce oluşturulmuş) veritabanlarında sütun yoksa ekler.
-- Zaten varsa hiçbir şey yapmaz (idempotent). Yeni eklenen sorularda ve
-- eski sorularda başlangıç değeri 2 olur.
alter table questions
  add column if not exists frequency_weight int not null default 2
  check (frequency_weight in (1,2,3));

-- 4. TEST OTURUMLARI
create table if not exists test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  department_id bigint references departments(id),
  province_id bigint references provinces(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds int not null default 1800, -- 30 dakika
  total_questions int not null default 20,
  correct_count int,
  status text not null default 'in_progress' check (status in ('in_progress','completed','timeout')),
  created_at timestamptz not null default now()
);

create index if not exists idx_test_sessions_province on test_sessions(province_id);
create index if not exists idx_test_sessions_status on test_sessions(status);
create index if not exists idx_test_sessions_started_at on test_sessions(started_at);

-- ============================================================
-- SONUÇ SAKLAMA AYARI (tek satırlık ayar tablosu)
-- retention_days = null  -> süresiz sakla, otomatik silme yok
-- retention_days = 15/30/90/... -> o gün sayısından eski sonuçlar silinir
-- ============================================================
create table if not exists app_settings (
  id int primary key default 1,
  retention_days int,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, retention_days)
values (1, null)
on conflict (id) do nothing;

-- 5. OTURUM BAŞINA SEÇİLEN SORULAR + CEVAPLAR
create table if not exists test_session_questions (
  id bigint generated always as identity primary key,
  session_id uuid not null references test_sessions(id) on delete cascade,
  question_id bigint not null references questions(id),
  question_order int not null,
  selected_option text check (selected_option in ('A','B','C','D')),
  is_correct boolean,
  answered_at timestamptz
);

create index if not exists idx_tsq_session on test_session_questions(session_id);
create index if not exists idx_tsq_question on test_session_questions(question_id);

-- ============================================================
-- RASTGELE 20 SORU SEÇEN FONKSİYON
-- ============================================================
create or replace function start_test_session(
  p_user_name text,
  p_department_id bigint,
  p_province_id bigint
) returns uuid
language plpgsql
security definer
as $$
declare
  v_session_id uuid;
  v_question record;
  v_order int := 1;
begin
  insert into test_sessions (user_name, department_id, province_id)
  values (p_user_name, p_department_id, p_province_id)
  returning id into v_session_id;

  -- Ağırlıklı rastgele seçim (Efraimidis–Spirakis algoritması):
  -- her aktif soru için random()^(1/sıklık) anahtarı üretilir ve bu
  -- anahtara göre büyükten küçüğe sıralanıp ilk 20 tanesi seçilir.
  -- Sıklık oranı ne kadar yüksekse (3 > 2 > 1), sorunun seçilme
  -- olasılığı o kadar artar. Soru sayısı ve sıklık dağılımı
  -- değiştikçe oranlar otomatik olarak yeniden hesaplanır çünkü
  -- hesaplama her seferinde canlı veriler üzerinden yapılır.
  for v_question in
    select id from questions
    where is_active = true
    order by random() ^ (1.0 / frequency_weight) desc
    limit 20
  loop
    insert into test_session_questions (session_id, question_id, question_order)
    values (v_session_id, v_question.id, v_order);
    v_order := v_order + 1;
  end loop;

  return v_session_id;
end;
$$;

-- ============================================================
-- TESTİ BİTİREN (manuel ya da süre dolduğunda) FONKSİYON
-- ============================================================
create or replace function finish_test_session(p_session_id uuid, p_timeout boolean default false)
returns void
language plpgsql
security definer
as $$
declare
  v_correct int;
begin
  select count(*) into v_correct
  from test_session_questions
  where session_id = p_session_id and is_correct = true;

  update test_sessions
  set finished_at = now(),
      correct_count = v_correct,
      status = case when p_timeout then 'timeout' else 'completed' end
  where id = p_session_id and status = 'in_progress';
end;
$$;

-- ============================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================
alter table provinces enable row level security;
alter table departments enable row level security;
alter table questions enable row level security;
alter table test_sessions enable row level security;
alter table test_session_questions enable row level security;
alter table app_settings enable row level security;

-- Herkes il ve departman listesini okuyabilir (form için)
drop policy if exists "provinces_public_read" on provinces;
create policy "provinces_public_read" on provinces for select using (true);

drop policy if exists "departments_public_read" on departments;
create policy "departments_public_read" on departments for select using (true);

-- ÖNEMLİ: test_sessions / test_session_questions tabloları için anonim
-- kullanıcılara HİÇBİR doğrudan select/insert policy'si TANIMLANMAZ.
-- Tüm katılımcı işlemleri (oturum başlatma, cevap kaydetme, bitirme,
-- kendi sonucunu görme) "security definer" RPC fonksiyonları üzerinden
-- yapılır; bu fonksiyonlar RLS'yi atlayarak (owner yetkisiyle) çalışır.
-- Böylece bir katılımcı anon key ile doğrudan sorgu atıp başkasının
-- sonuçlarını listeleyemez.

-- Sadece giriş yapmış (admin) kullanıcılar tabloyu doğrudan görebilir:
drop policy if exists "sessions_select_admin_only" on test_sessions;
create policy "sessions_select_admin_only" on test_sessions
  for select using (auth.role() = 'authenticated');

drop policy if exists "tsq_select_admin_only" on test_session_questions;
create policy "tsq_select_admin_only" on test_session_questions
  for select using (auth.role() = 'authenticated');

-- questions tablosu anonim kullanıcıdan DOĞRUDAN okunmaz (correct_option
-- sızmasın diye). Katılımcı tarafı sadece get_session_questions RPC'sini
-- kullanır (doğru cevap alanı döndürmez). Admin paneli ise giriş yaptığı
-- için bu politika sayesinde questions tablosunu (correct_option dahil)
-- doğrudan görebilir.
drop policy if exists "questions_admin_read" on questions;
create policy "questions_admin_read" on questions
  for select using (auth.role() = 'authenticated');

-- Admin panelinden soru ekleme / durum-sıklık güncelleme / silme
-- işlemleri için de yetki gerekiyor (önceden sadece okuma izni vardı,
-- bu yüzden pasifleştirme ve sıklık güncelleme sessizce başarısız oluyordu):
drop policy if exists "questions_admin_insert" on questions;
create policy "questions_admin_insert" on questions
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "questions_admin_update" on questions;
create policy "questions_admin_update" on questions
  for update using (auth.role() = 'authenticated');

drop policy if exists "questions_admin_delete" on questions;
create policy "questions_admin_delete" on questions
  for delete using (auth.role() = 'authenticated');

-- Sonuç saklama ayarını sadece admin görebilir/güncelleyebilir
drop policy if exists "app_settings_admin_read" on app_settings;
create policy "app_settings_admin_read" on app_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "app_settings_admin_update" on app_settings;
create policy "app_settings_admin_update" on app_settings
  for update using (auth.role() = 'authenticated');

-- ============================================================
-- OTURUMUN SORULARINI (doğru cevap gizli) GETİREN FONKSİYON
-- ============================================================
create or replace function get_session_questions(p_session_id uuid)
returns table (
  tsq_id bigint,
  question_id bigint,
  question_order int,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  selected_option text
)
language sql
security definer
as $$
  select tsq.id, q.id, tsq.question_order, q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d, tsq.selected_option
  from test_session_questions tsq
  join questions q on q.id = tsq.question_id
  where tsq.session_id = p_session_id
  order by tsq.question_order;
$$;

-- ============================================================
-- CEVAP KAYDEDEN FONKSİYON (doğruluğu server-side kontrol eder)
-- ============================================================
create or replace function submit_answer(
  p_session_id uuid,
  p_question_id bigint,
  p_selected_option text
) returns void
language plpgsql
security definer
as $$
declare
  v_correct_option text;
begin
  select correct_option into v_correct_option from questions where id = p_question_id;

  update test_session_questions
  set selected_option = p_selected_option,
      is_correct = (p_selected_option = v_correct_option),
      answered_at = now()
  where session_id = p_session_id and question_id = p_question_id;
end;
$$;

-- ============================================================
-- KATILIMCININ KENDİ SONUCUNU GETİRMESİ İÇİN FONKSİYON
-- (test_sessions tablosuna doğrudan erişim olmadığı için gerekli)
-- ============================================================
create or replace function get_session_result(p_session_id uuid)
returns table (
  user_name text,
  total_questions int,
  correct_count int,
  status text
)
language sql
security definer
as $$
  select user_name, total_questions, correct_count, status
  from test_sessions
  where id = p_session_id;
$$;

-- ============================================================
-- YÖNETİCİ İÇİN: SORU ANALİTİĞİ VIEW'İ
-- (her sorunun kaç kez sorulduğu, doğruluk oranı)
-- ============================================================
drop view if exists question_analytics;

create view question_analytics as
select
  q.id as question_id,
  q.question_text,
  count(tsq.id) filter (where tsq.selected_option is not null) as answered_count,
  count(tsq.id) filter (where tsq.is_correct = true) as correct_count,
  count(tsq.id) filter (where tsq.is_correct = false) as wrong_count,
  count(tsq.id) filter (
    where tsq.selected_option is null
      and tsq.session_id in (select id from test_sessions where status <> 'in_progress')
  ) as blank_count,
  case
    when count(tsq.id) filter (where tsq.selected_option is not null) = 0 then null
    else round(
      100.0 * count(tsq.id) filter (where tsq.is_correct = true)
      / count(tsq.id) filter (where tsq.selected_option is not null), 1
    )
  end as accuracy_percent
from questions q
left join test_session_questions tsq on tsq.question_id = q.id
group by q.id, q.question_text;

-- Not: questions tablosunda RLS "false" olduğu için bu view'e de
-- sadece admin (service role / admin auth) erişecek şekilde
-- ayrıca bir admin_users tablosu + auth kontrolü önerilir (bkz. README).

-- ============================================================
-- SONUÇ SAKLAMA SÜRESİ: AYARI KAYDET + ESKİ SONUÇLARI SİL
-- p_days = null  -> süresiz sakla (hiçbir şey silinmez, sadece ayar güncellenir)
-- p_days = 15/30/90/... -> o günden eski tüm test_sessions kayıtları
-- (ve cascade ile test_session_questions) kalıcı olarak silinir.
-- Dönüş değeri: silinen sonuç (test_sessions) sayısı.
-- ============================================================
create or replace function set_result_retention(p_days int)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int := 0;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Yetkisiz erişim';
  end if;

  update app_settings
  set retention_days = p_days, updated_at = now()
  where id = 1;

  if p_days is not null then
    with removed as (
      delete from test_sessions
      where started_at < now() - (p_days || ' days')::interval
      returning id
    )
    select count(*) into v_deleted from removed;
  end if;

  return v_deleted;
end;
$$;

-- ============================================================
-- KAYITLI SAKLAMA AYARINA GÖRE ESKİ SONUÇLARI TEMİZLER
-- Admin paneli her açıldığında çağrılır; böylece belirlenen süre
-- dışında kalan sonuçlar otomatik olarak silinmiş olur.
-- ============================================================
create or replace function run_retention_cleanup()
returns int
language plpgsql
security definer
as $$
declare
  v_days int;
  v_deleted int := 0;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Yetkisiz erişim';
  end if;

  select retention_days into v_days from app_settings where id = 1;

  if v_days is not null then
    with removed as (
      delete from test_sessions
      where started_at < now() - (v_days || ' days')::interval
      returning id
    )
    select count(*) into v_deleted from removed;
  end if;

  return v_deleted;
end;
$$;
