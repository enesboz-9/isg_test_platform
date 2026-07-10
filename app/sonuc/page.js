"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toTitleCaseTR } from "@/lib/formatName";
import TopbarExtras from "@/components/TopbarExtras";

export default function SonucPage() {
  return (
    <Suspense fallback={null}>
      <SonucPageInner />
    </Suspense>
  );
}

function SonucPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    async function loadSession() {
      const { data } = await supabase.rpc("get_session_result", {
        p_session_id: sessionId,
      });
      setSession(data && data.length > 0 ? data[0] : null);
      setLoading(false);
    }
    loadSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="page">
        <div className="content">
          <div className="card">
            <p className="subtitle">Sonuç hesaplanıyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page">
        <div className="content">
          <div className="card">
            <p className="subtitle">Sonuç bulunamadı.</p>
          </div>
        </div>
      </div>
    );
  }

  const total = session.total_questions ?? 20;
  const correct = session.correct_count ?? 0;
  const wasTimeout = session.status === "timeout";

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">İSG Değerlendirme Testi</span>
          <span className="sub">YEDAŞ · İş Sağlığı ve Güvenliği</span>
        </div>
        <TopbarExtras />
      </div>

      <div className="content">
        <div className="card">
          <div className="result-hero">
            <div className="score">
              {correct}/{total}
            </div>
            <div className="score-label">
              {wasTimeout
                ? "Süre doldu, test otomatik olarak sonlandırıldı."
                : "Test tamamlandı."}
            </div>
          </div>

          <p className="subtitle" style={{ textAlign: "center" }}>
            Sayın {toTitleCaseTR(session.user_name)}, testiniz kaydedildi ve yönetici paneline
            iletildi. Katılımınız için teşekkür ederiz.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => router.push("/")}
          >
            Çıkış
          </button>
        </div>
      </div>
    </div>
  );
}
