-- Kuota harian asisten AI (aturan system design 1, backlog PB-21).
--
-- Pembatas laju per menit di `src/lib/rate-limit.ts` hidup di memori satu
-- proses, sehingga di hosting serverless setiap instance menghitung sendiri.
-- Kuota harian butuh hitungan bersama lintas instance, jadi disimpan di sini.
--
-- Privasi: kolom `subject` berisi HMAC dari IP pengunjung (dihitung di
-- aplikasi dengan rahasia `AI_QUOTA_SECRET`), bukan IP mentah. Baris khusus
-- `subject = '*'` adalah total seluruh pengunjung pada hari itu.
-- Hari dihitung dalam WIB, sama dengan kunci pemeriksaan harga harian.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  day     DATE NOT NULL,
  subject TEXT NOT NULL CHECK (length(subject) > 0),
  calls   INTEGER NOT NULL DEFAULT 0 CHECK (calls >= 0),
  PRIMARY KEY (day, subject)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_daily FROM anon, authenticated;

-- Memakai satu jatah bila kuota pengunjung DAN kuota total masih tersisa.
-- Kedua baris dikunci (urutan tetap: pengunjung lalu total) sehingga dua
-- permintaan bersamaan tidak bisa sama-sama lolos di jatah terakhir, dan
-- jatah tidak terpakai bila salah satu kuota sudah habis.
CREATE OR REPLACE FUNCTION public.ai_consume_quota(
  p_subject TEXT,
  p_subject_limit INTEGER,
  p_global_limit INTEGER
)
RETURNS TABLE (allowed BOOLEAN, subject_calls INTEGER, global_calls INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  v_subject INTEGER;
  v_global INTEGER;
BEGIN
  IF p_subject IS NULL OR length(p_subject) = 0 OR p_subject = '*' THEN
    RAISE EXCEPTION 'subject kuota tidak valid';
  END IF;

  INSERT INTO public.ai_usage_daily (day, subject) VALUES (v_day, p_subject), (v_day, '*')
  ON CONFLICT (day, subject) DO NOTHING;

  SELECT u.calls INTO v_subject FROM public.ai_usage_daily u
  WHERE u.day = v_day AND u.subject = p_subject FOR UPDATE;
  SELECT u.calls INTO v_global FROM public.ai_usage_daily u
  WHERE u.day = v_day AND u.subject = '*' FOR UPDATE;

  IF v_subject >= p_subject_limit OR v_global >= p_global_limit THEN
    RETURN QUERY SELECT false, v_subject, v_global;
    RETURN;
  END IF;

  UPDATE public.ai_usage_daily u SET calls = u.calls + 1
  WHERE u.day = v_day AND u.subject IN (p_subject, '*');

  RETURN QUERY SELECT true, v_subject + 1, v_global + 1;
END;
$$;

-- Retensi: hitungan harian tidak berguna setelah lewat; dipanggil cron harian.
CREATE OR REPLACE FUNCTION public.ai_purge_usage(p_keep_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.ai_usage_daily
    WHERE day < (now() AT TIME ZONE 'Asia/Jakarta')::date - GREATEST(p_keep_days, 1)
    RETURNING 1
  )
  SELECT count(*)::int FROM gone
$$;

REVOKE EXECUTE ON FUNCTION public.ai_consume_quota(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_purge_usage(INTEGER) FROM PUBLIC, anon, authenticated;
