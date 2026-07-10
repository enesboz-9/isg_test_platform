"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAdminGuard } from "@/lib/useAdminGuard";
import TopbarExtras from "@/components/TopbarExtras";

export default function AdminAnalitikPage() {
  const { checking } = useAdminGuard();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("most_wrong");

  useEffect(() => {
    if (checking) return;
    async function loadAnalytics() {
      setLoading(true);
      const { data, error } = await supabase
        .from("question_analytics")
        .select("*");
      if (!error) setRows(data ?? []);
      setLoading(false);
    }
    loadAnalytics();
  }, [checking]);

  if (checking) return null;

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "most_wrong") return (b.wrong_count ?? 0) - (a.wrong_count ?? 0);
    if (sortBy === "lowest_accuracy") {
      const aAcc = a.accuracy_percent ?? 101;
      const bAcc = b.accuracy_percent ?? 101;
      return aAcc - bAcc;
    }
    if (sortBy === "most_blank") return (b.blank_count ?? 0) - (a.blank_count ?? 0);
    return (b.answered_count ?? 0) - (a.answered_count ?? 0);
  });

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">YEDAŞ İSG Test Platformu</span>
          <span className="sub">Yönetici Paneli</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/admin" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
            Sonuçlara Dön
          </Link>
          <TopbarExtras />
        </div>
      </div>

      <div className="content">
        <div className="card full">
          <h1 className="title">Soru Analitiği</h1>
          <p className="subtitle">
            Her sorunun tüm katılımcılar arasındaki doğruluk oranı ve en çok
            yanlış yapılan sorular.
          </p>

          <div className="filters">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="most_wrong">En çok yanlış yapılana göre sırala</option>
              <option value="lowest_accuracy">En düşük doğruluk oranına göre sırala</option>
              <option value="most_answered">En çok cevaplanana göre sırala</option>
              <option value="most_blank">En çok boş bırakılana göre sırala</option>
            </select>
          </div>

          {loading ? (
            <p className="subtitle">Yükleniyor...</p>
          ) : sorted.length === 0 ? (
            <div className="empty-state">Henüz hiç soru cevaplanmamış.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Soru</th>
                  <th>Cevaplanma</th>
                  <th>Doğru</th>
                  <th>Yanlış</th>
                  <th>Boş Bırakılan</th>
                  <th>Doğruluk</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.question_id}>
                    <td style={{ maxWidth: 480 }}>{r.question_text}</td>
                    <td>{r.answered_count ?? 0}</td>
                    <td>{r.correct_count ?? 0}</td>
                    <td>{r.wrong_count ?? 0}</td>
                    <td>{r.blank_count ?? 0}</td>
                    <td>
                      {r.accuracy_percent === null ? (
                        <span className="badge neutral">Veri yok</span>
                      ) : r.accuracy_percent < 50 ? (
                        <span className="badge danger">%{r.accuracy_percent}</span>
                      ) : (
                        <span className="badge success">%{r.accuracy_percent}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
