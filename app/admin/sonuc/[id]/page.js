"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { toTitleCaseTR } from "@/lib/formatName";
import TopbarExtras from "@/components/TopbarExtras";

function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return "-";
  const seconds = Math.max(
    0,
    Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)
  );
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} dk ${String(s).padStart(2, "0")} sn`;
}

export default function AdminSessionDetail() {
  const { checking } = useAdminGuard();
  const params = useParams();
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checking || !sessionId) return;

    async function loadDetail() {
      setLoading(true);

      const { data: sessionData } = await supabase
        .from("test_sessions")
        .select("*, departments(name), provinces(name)")
        .eq("id", sessionId)
        .single();
      setSession(sessionData);

      // Admin authenticated olduğu için questions tablosuna da doğrudan
      // erişebiliyor (correct_option dahil) - RLS "questions_admin_read" policy'si.
      const { data: answerData } = await supabase
        .from("test_session_questions")
        .select(
          "question_order, selected_option, is_correct, questions(question_text, option_a, option_b, option_c, option_d, correct_option)"
        )
        .eq("session_id", sessionId)
        .order("question_order");

      setAnswers(answerData ?? []);
      setLoading(false);
    }
    loadDetail();
  }, [checking, sessionId]);

  if (checking || loading) return null;

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

  const wrongAnswers = answers.filter((a) => a.is_correct === false);

  function optionLabel(q, letter) {
    if (!letter) return "Boş bırakıldı";
    const map = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    return `${letter} — ${map[letter]}`;
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">YEDAŞ İSG Test Platformu</span>
          <span className="sub">Yönetici Paneli</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/admin" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
            Listeye Dön
          </Link>
          <TopbarExtras />
        </div>
      </div>

      <div className="content">
        <div className="card wide">
          <h1 className="title">{toTitleCaseTR(session.user_name)}</h1>
          <p className="subtitle">
            {session.departments?.name ?? "-"} · {session.provinces?.name ?? "-"} ·{" "}
            {new Date(session.started_at).toLocaleString("tr-TR")}
          </p>

          <div className="stat-grid">
            <div className="stat-box">
              <div className="num">
                {session.correct_count ?? "-"}/{session.total_questions}
              </div>
              <div className="label">Skor</div>
            </div>
            <div className="stat-box">
              <div className="num">{wrongAnswers.length}</div>
              <div className="label">Yanlış Sayısı</div>
            </div>
            <div className="stat-box">
              <div className="num">
                {session.status === "timeout" ? "Süre Doldu" : "Tamamlandı"}
              </div>
              <div className="label">Durum</div>
            </div>
            <div className="stat-box">
              <div className="num">{formatDuration(session.started_at, session.finished_at)}</div>
              <div className="label">Çözüm Süresi</div>
            </div>
          </div>

          <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Yanlış Yapılan Sorular</h2>

          {wrongAnswers.length === 0 ? (
            <div className="empty-state">Bu katılımcı tüm soruları doğru yanıtlamış.</div>
          ) : (
            wrongAnswers.map((a, idx) => (
              <div key={idx} className="stat-box" style={{ marginBottom: 12 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>
                  {a.question_order}. {a.questions.question_text}
                </p>
                <p style={{ color: "var(--color-danger)", margin: "4px 0", fontSize: "0.9rem" }}>
                  Verilen cevap: {optionLabel(a.questions, a.selected_option)}
                </p>
                <p style={{ color: "var(--color-success)", margin: "4px 0", fontSize: "0.9rem" }}>
                  Doğru cevap: {optionLabel(a.questions, a.questions.correct_option)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
