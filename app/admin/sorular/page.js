"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAdminGuard } from "@/lib/useAdminGuard";
import TopbarExtras from "@/components/TopbarExtras";

const emptyForm = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A",
  frequency_weight: 2,
};

export default function AdminSorularPage() {
  const { checking } = useAdminGuard();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [balancing, setBalancing] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .order("id", { ascending: false });
    setQuestions(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!checking) loadQuestions();
  }, [checking]);

  if (checking) return null;

  async function handleAdd(e) {
    e.preventDefault();
    setError("");

    if (
      !form.question_text.trim() ||
      !form.option_a.trim() ||
      !form.option_b.trim() ||
      !form.option_c.trim() ||
      !form.option_d.trim()
    ) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("questions").insert({
      question_text: form.question_text.trim(),
      option_a: form.option_a.trim(),
      option_b: form.option_b.trim(),
      option_c: form.option_c.trim(),
      option_d: form.option_d.trim(),
      correct_option: form.correct_option,
      frequency_weight: form.frequency_weight,
    });
    setSaving(false);

    if (insertError) {
      setError("Kaydedilemedi: " + insertError.message);
      return;
    }

    setForm(emptyForm);
    loadQuestions();
  }

  async function toggleActive(q) {
    const { error: updateError } = await supabase
      .from("questions")
      .update({ is_active: !q.is_active })
      .eq("id", q.id);
    if (updateError) {
      alert("Durum güncellenemedi: " + updateError.message);
      return;
    }
    loadQuestions();
  }

  async function updateFrequency(q, newWeight) {
    const { error: updateError } = await supabase
      .from("questions")
      .update({ frequency_weight: Number(newWeight) })
      .eq("id", q.id);
    if (updateError) {
      alert("Sıklık güncellenemedi: " + updateError.message);
      return;
    }
    loadQuestions();
  }

  async function deleteQuestion(q) {
    if (!confirm("Bu soruyu silmek istediğinize emin misiniz?")) return;
    const { error: deleteError } = await supabase.from("questions").delete().eq("id", q.id);
    if (deleteError) {
      alert("Silinemedi: " + deleteError.message);
      return;
    }
    loadQuestions();
  }

  const totalActiveWeight = questions
    .filter((q) => q.is_active)
    .reduce((sum, q) => sum + (q.frequency_weight ?? 2), 0);

  // Doğru cevap harfine göre soru sayıları (A/B/C/D dağılımı)
  const letters = ["A", "B", "C", "D"];
  const correctCounts = letters.reduce((acc, l) => {
    acc[l] = questions.filter((q) => q.correct_option === l).length;
    return acc;
  }, {});

  async function rebalanceDistribution() {
    if (questions.length === 0) return;
    const ok = confirm(
      "Havuzdaki tüm soruların doğru cevap harfleri A/B/C/D arasında " +
        "dengeli dağıtılacak. Seçeneklerin metinleri (doğru ve yanlış " +
        "cevapların içeriği) DEĞİŞMEZ; sadece doğru cevabın hangi şıkta " +
        "(A, B, C veya D) göründüğü yeniden düzenlenir. Devam edilsin mi?"
    );
    if (!ok) return;

    setBalancing(true);
    setError("");

    try {
      // id'ye göre sıralı, kararlı bir sırayla A,B,C,D,A,B,C,D... hedef
      // harfleri döngüsel olarak atanır. Bu, önceki dağılım ne olursa
      // olsun sonucu otomatik olarak dengeler (fark en fazla 1 olur).
      const sorted = [...questions].sort((a, b) => a.id - b.id);
      const optionKeys = ["option_a", "option_b", "option_c", "option_d"];

      const updates = [];

      sorted.forEach((q, idx) => {
        const targetLetter = letters[idx % 4];
        if (targetLetter === q.correct_option) return; // zaten doğru yerde

        const currentIndex = letters.indexOf(q.correct_option);
        const correctText = q[optionKeys[currentIndex]];
        const wrongTexts = optionKeys
          .filter((_, i) => i !== currentIndex)
          .map((k) => q[k]);

        const targetIndex = letters.indexOf(targetLetter);
        const newOptions = new Array(4);
        newOptions[targetIndex] = correctText;
        let wi = 0;
        for (let i = 0; i < 4; i++) {
          if (i === targetIndex) continue;
          newOptions[i] = wrongTexts[wi];
          wi++;
        }

        updates.push({
          id: q.id,
          payload: {
            option_a: newOptions[0],
            option_b: newOptions[1],
            option_c: newOptions[2],
            option_d: newOptions[3],
            correct_option: targetLetter,
          },
        });
      });

      if (updates.length === 0) {
        alert("Dağılım zaten dengeli, değişiklik yapılmadı.");
        setBalancing(false);
        return;
      }

      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("questions").update(u.payload).eq("id", u.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed) {
        setError("Bazı sorular güncellenemedi: " + failed.error.message);
      } else {
        alert(`${updates.length} sorunun doğru cevap şıkkı yeniden dengelendi.`);
      }
    } finally {
      setBalancing(false);
      loadQuestions();
    }
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
            Sonuçlara Dön
          </Link>
          <TopbarExtras />
        </div>
      </div>

      <div className="content">
        <div className="card full">
          <h1 className="title">Soru Havuzu</h1>
          <p className="subtitle">
            Testlerde rastgele seçilecek soruları buradan yönetin. Her test
            oturumu, "aktif" işaretli sorular arasından ağırlıklı olarak
            rastgele 20 tanesini seçer — sıklık oranı yüksek olan sorular
            daha sık, düşük olanlar daha az görünür.
          </p>

          <form onSubmit={handleAdd} style={{ marginBottom: 32 }}>
            <label>Soru Metni</label>
            <input
              type="text"
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              placeholder="Örn. İş kazası anında ilk yapılması gereken nedir?"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label>A Seçeneği</label>
                <input
                  type="text"
                  value={form.option_a}
                  onChange={(e) => setForm({ ...form, option_a: e.target.value })}
                />
              </div>
              <div>
                <label>B Seçeneği</label>
                <input
                  type="text"
                  value={form.option_b}
                  onChange={(e) => setForm({ ...form, option_b: e.target.value })}
                />
              </div>
              <div>
                <label>C Seçeneği</label>
                <input
                  type="text"
                  value={form.option_c}
                  onChange={(e) => setForm({ ...form, option_c: e.target.value })}
                />
              </div>
              <div>
                <label>D Seçeneği</label>
                <input
                  type="text"
                  value={form.option_d}
                  onChange={(e) => setForm({ ...form, option_d: e.target.value })}
                />
              </div>
            </div>

            <label>Doğru Cevap</label>
            <select
              value={form.correct_option}
              onChange={(e) => setForm({ ...form, correct_option: e.target.value })}
              style={{ maxWidth: 120 }}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>

            <label>Görülme Sıklığı</label>
            <select
              value={form.frequency_weight}
              onChange={(e) => setForm({ ...form, frequency_weight: Number(e.target.value) })}
              style={{ maxWidth: 220 }}
            >
              <option value={1}>1 - Az sıklıkta çıksın</option>
              <option value={2}>2 - Normal (varsayılan)</option>
              <option value={3}>3 - Sık çıksın</option>
            </select>
            <p className="subtitle" style={{ marginTop: 4, fontSize: "0.8rem" }}>
              Değer ne kadar yüksekse, soru katılımcının karşısına çıkma olasılığı o kadar artar.
            </p>

            {error && <div className="error-text">{error}</div>}

            <button className="btn btn-amber" type="submit" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Soruyu Ekle"}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <h2 style={{ fontSize: "1.05rem", margin: 0 }}>
              Mevcut Sorular ({questions.length})
            </h2>
            {questions.length > 0 && (
              <button
                className="btn btn-outline"
                style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                onClick={rebalanceDistribution}
                disabled={balancing}
              >
                {balancing ? "Dengeleniyor..." : "Doğru Cevap Dağılımını Dengele"}
              </button>
            )}
          </div>

          {questions.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              {letters.map((l) => {
                const count = correctCounts[l];
                const pct = questions.length
                  ? ((count / questions.length) * 100).toFixed(0)
                  : 0;
                return (
                  <span key={l} className="badge neutral">
                    Doğru cevap {l}: {count} (%{pct})
                  </span>
                );
              })}
            </div>
          )}

          {loading ? (
            <p className="subtitle">Yükleniyor...</p>
          ) : questions.length === 0 ? (
            <div className="empty-state">Henüz soru eklenmemiş.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Soru</th>
                  <th>Doğru Cevap</th>
                  <th>Sıklık</th>
                  <th>Görülme İhtimali</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td style={{ maxWidth: 480 }}>{q.question_text}</td>
                    <td>{q.correct_option}</td>
                    <td>
                      <select
                        value={q.frequency_weight ?? 2}
                        onChange={(e) => updateFrequency(q, e.target.value)}
                        style={{ maxWidth: 100 }}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </td>
                    <td>
                      {q.is_active && totalActiveWeight > 0
                        ? `%${(((q.frequency_weight ?? 2) / totalActiveWeight) * 100).toFixed(2)}`
                        : "-"}
                    </td>
                    <td>
                      {q.is_active ? (
                        <span className="badge success">Aktif</span>
                      ) : (
                        <span className="badge neutral">Pasif</span>
                      )}
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                        onClick={() => toggleActive(q)}
                      >
                        {q.is_active ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: "0.8rem", color: "var(--color-danger)" }}
                        onClick={() => deleteQuestion(q)}
                      >
                        Sil
                      </button>
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
