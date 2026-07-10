"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TopbarExtras from "@/components/TopbarExtras";

const DURATION_SECONDS = 30 * 60;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TestPage() {
  return (
    <Suspense fallback={null}>
      <TestPageInner />
    </Suspense>
  );
}

function TestPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);
  const finishedRef = useRef(false);

  const finishTest = useCallback(
    async (timeout) => {
      if (finishedRef.current || !sessionId) return;
      finishedRef.current = true;
      await supabase.rpc("finish_test_session", {
        p_session_id: sessionId,
        p_timeout: timeout,
      });
      router.push(`/sonuc?session=${sessionId}`);
    },
    [sessionId, router]
  );

  // Soruları yükle
  useEffect(() => {
    if (!sessionId) {
      router.push("/");
      return;
    }
    async function loadQuestions() {
      const { data, error } = await supabase.rpc("get_session_questions", {
        p_session_id: sessionId,
      });
      if (error || !data || data.length === 0) {
        router.push("/");
        return;
      }
      setQuestions(data);
      setLoading(false);
    }
    loadQuestions();
  }, [sessionId, router]);

  // Sayaç: her saniye azalt, 0 olunca otomatik bitir
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          finishTest(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, finishTest]);

  async function handleSelect(option) {
    const q = questions[current];
    setQuestions((prev) =>
      prev.map((item, idx) =>
        idx === current ? { ...item, selected_option: option } : item
      )
    );
    await supabase.rpc("submit_answer", {
      p_session_id: sessionId,
      p_question_id: q.question_id,
      p_selected_option: option,
    });
  }

  async function handleFinishClick() {
    setSubmitting(true);
    await finishTest(false);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="content">
          <div className="card">
            <p className="subtitle">Sorular yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const answeredCount = questions.filter((x) => x.selected_option).length;
  const progressPercent = ((current + 1) / questions.length) * 100;
  const isLast = current === questions.length - 1;
  const isWarning = secondsLeft <= 60;

  const options = [
    { key: "A", text: q.option_a },
    { key: "B", text: q.option_b },
    { key: "C", text: q.option_c },
    { key: "D", text: q.option_d },
  ];

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
        <div className="card wide">
          <div className="exam-header">
            <span className="question-count">
              Soru {current + 1} / {questions.length} · Cevaplanan: {answeredCount}
            </span>
            <span className={`timer ${isWarning ? "warning" : ""}`}>
              {formatTime(secondsLeft)}
            </span>
          </div>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <p className="question-text">{q.question_text}</p>

          {options.map((opt) => (
            <div
              key={opt.key}
              className={`option ${q.selected_option === opt.key ? "selected" : ""}`}
              onClick={() => handleSelect(opt.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleSelect(opt.key);
              }}
            >
              <span className="letter">{opt.key}</span>
              <span>{opt.text}</span>
            </div>
          ))}

          <div className="nav-row">
            <button
              className="btn btn-outline"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              Önceki Soru
            </button>

            {isLast ? (
              <button
                className="btn btn-amber"
                onClick={handleFinishClick}
                disabled={submitting}
              >
                {submitting ? "Gönderiliyor..." : "Testi Bitir"}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "auto" }}
                onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              >
                Sonraki Soru
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
