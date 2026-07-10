"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { toTitleCaseTR } from "@/lib/formatName";
import TopbarExtras from "@/components/TopbarExtras";

function statusBadge(status) {
  if (status === "completed") return <span className="badge success">Tamamlandı</span>;
  if (status === "timeout") return <span className="badge danger">Süre Doldu</span>;
  return <span className="badge neutral">Devam Ediyor</span>;
}

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

const RETENTION_OPTIONS = [
  { value: "none", days: null, label: "Süresiz (hiç silme)" },
  { value: "15", days: 15, label: "Son 15 gün" },
  { value: "30", days: 30, label: "Son 1 ay" },
  { value: "90", days: 90, label: "Son 3 ay" },
  { value: "180", days: 180, label: "Son 6 ay" },
  { value: "365", days: 365, label: "Son 1 yıl" },
];

function retentionSelectValue(days) {
  if (days == null) return "none";
  const match = RETENTION_OPTIONS.find((o) => o.days === days);
  return match ? match.value : "none";
}

function retentionLabel(days) {
  if (days == null) return "Süresiz";
  const match = RETENTION_OPTIONS.find((o) => o.days === days);
  return match ? match.label : `Son ${days} gün`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { checking } = useAdminGuard();

  const [provinces, setProvinces] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [provinceFilter, setProvinceFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState("started_at");
  const [sortDir, setSortDir] = useState("desc");
  const [retentionDays, setRetentionDays] = useState(null);
  const [retentionDraft, setRetentionDraft] = useState("none");
  const [savingRetention, setSavingRetention] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  function toggleGroup(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "started_at" ? "desc" : "desc");
    }
  }

  function sortIndicator(field) {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  useEffect(() => {
    if (checking) return;

    async function loadFilters() {
      const [{ data: provs }, { data: deps }] = await Promise.all([
        supabase.from("provinces").select("id, name").order("name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      setProvinces(provs ?? []);
      setDepartments(deps ?? []);
    }
    loadFilters();
  }, [checking]);

  async function loadSessions() {
    setLoading(true);
    let query = supabase
      .from("test_sessions")
      .select(
        "id, user_name, status, correct_count, total_questions, started_at, finished_at, departments(name), provinces(name)"
      )
      .order("started_at", { ascending: false });

    if (provinceFilter) query = query.eq("province_id", provinceFilter);
    if (departmentFilter) query = query.eq("department_id", departmentFilter);

    const { data, error } = await query;
    if (!error) setSessions(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (checking) return;
    loadSessions();
  }, [checking, provinceFilter, departmentFilter]);

  useEffect(() => {
    if (checking) return;

    async function loadRetentionAndCleanup() {
      // Kayıtlı saklama süresini oku ve bu süre dışında kalan
      // sonuçları sessizce temizle; ardından listeyi tazele.
      const { data } = await supabase
        .from("app_settings")
        .select("retention_days")
        .eq("id", 1)
        .single();

      const days = data?.retention_days ?? null;
      setRetentionDays(days);
      setRetentionDraft(retentionSelectValue(days));

      const { data: deletedCount } = await supabase.rpc("run_retention_cleanup");
      if (deletedCount) loadSessions();
    }
    loadRetentionAndCleanup();
  }, [checking]);

  async function handleSaveRetention() {
    const option = RETENTION_OPTIONS.find((o) => o.value === retentionDraft);
    const days = option ? option.days : null;

    const confirmMsg =
      days === null
        ? "Saklama süresi sınırsız yapılacak, sonuçlar otomatik silinmeyecek. Onaylıyor musunuz?"
        : `Bu işlem, "${retentionLabel(days)}" dışında kalan TÜM sınav sonuçlarını kalıcı olarak silecek. Onaylıyor musunuz?`;
    if (!confirm(confirmMsg)) return;

    setSavingRetention(true);
    const { data: deletedCount, error } = await supabase.rpc("set_result_retention", {
      p_days: days,
    });
    setSavingRetention(false);

    if (error) {
      alert("Kaydedilemedi: " + error.message);
      return;
    }

    setRetentionDays(days);
    alert(
      days === null
        ? "Saklama süresi sınırsız olarak ayarlandı."
        : `${deletedCount ?? 0} eski sonuç silindi. Saklama süresi güncellendi.`
    );
    loadSessions();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  if (checking) return null;

  function scoreRatio(s) {
    if (s.correct_count == null || !s.total_questions) return -1;
    return s.correct_count / s.total_questions;
  }

  const normalizedNameFilter = nameFilter.trim().toLocaleLowerCase("tr-TR");
  const filteredSessions = normalizedNameFilter
    ? sessions.filter((s) =>
        (s.user_name ?? "").toLocaleLowerCase("tr-TR").includes(normalizedNameFilter)
      )
    : sessions;

  // Aynı ad soyada sahip katılımcıların tüm denemelerini tek grupta
  // topla; en son sınav en üstte, diğerleri genişletildiğinde görünür.
  const groupsByName = new Map();
  for (const s of filteredSessions) {
    const key = (s.user_name ?? "").trim().toLocaleLowerCase("tr-TR");
    if (!groupsByName.has(key)) groupsByName.set(key, []);
    groupsByName.get(key).push(s);
  }

  const groups = Array.from(groupsByName.entries()).map(([key, list]) => {
    const sortedByDate = [...list].sort(
      (a, b) => new Date(b.started_at) - new Date(a.started_at)
    );
    return {
      key,
      latest: sortedByDate[0],
      others: sortedByDate.slice(1),
    };
  });

  const sortedGroups = groups.sort((a, b) => {
    let diff;
    if (sortField === "score") {
      diff = scoreRatio(a.latest) - scoreRatio(b.latest);
    } else {
      diff = new Date(a.latest.started_at) - new Date(b.latest.started_at);
    }
    return sortDir === "asc" ? diff : -diff;
  });

  const completedSessions = sessions.filter((s) => s.status !== "in_progress");
  const avgScore =
    completedSessions.length > 0
      ? (
          completedSessions.reduce((sum, s) => sum + (s.correct_count ?? 0), 0) /
          completedSessions.length
        ).toFixed(1)
      : "-";

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">YEDAŞ İSG Test Platformu</span>
          <span className="sub">Yönetici Paneli</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/admin/sorular" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
            Soru Havuzu
          </Link>
          <Link href="/admin/analitik" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
            Soru Analitiği
          </Link>
          <button className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }} onClick={handleLogout}>
            Çıkış Yap
          </button>
          <TopbarExtras />
        </div>
      </div>

      <div className="content">
        <div className="card full">
          <h1 className="title">Sınav Sonuçları</h1>
          <p className="subtitle">Tüm katılımcıların test sonuçlarını inceleyin.</p>

          <div
            className="stat-box"
            style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>
                Sonuç Saklama Süresi
              </div>
              <div className="label" style={{ marginTop: 0 }}>
                Şu an: <strong>{retentionLabel(retentionDays)}</strong> — bu süre dışında kalan
                sonuçlar kalıcı olarak silinir.
              </div>
            </div>
            <select
              value={retentionDraft}
              onChange={(e) => setRetentionDraft(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-amber"
              type="button"
              onClick={handleSaveRetention}
              disabled={savingRetention}
              style={{ padding: "10px 18px" }}
            >
              {savingRetention ? "Uygulanıyor..." : "Kaydet ve Uygula"}
            </button>
          </div>

          <div className="stat-grid">
            <div className="stat-box">
              <div className="num">{sessions.length}</div>
              <div className="label">Toplam Katılım</div>
            </div>
            <div className="stat-box">
              <div className="num">{completedSessions.length}</div>
              <div className="label">Tamamlanan Test</div>
            </div>
            <div className="stat-box">
              <div className="num">{avgScore}</div>
              <div className="label">Ortalama Doğru Sayısı</div>
            </div>
          </div>

          <div className="filters">
            <input
              type="text"
              placeholder="Ad soyad ile ara..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              style={{ minWidth: 220 }}
            />

            <select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)}>
              <option value="">Tüm İller</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">Tüm Departmanlar</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="subtitle">Yükleniyor...</p>
          ) : sortedGroups.length === 0 ? (
            <div className="empty-state">Bu filtreye uygun sonuç bulunamadı.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}></th>
                  <th>Ad Soyad</th>
                  <th>Departman</th>
                  <th>İl</th>
                  <th
                    onClick={() => handleSort("score")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Skor{sortIndicator("score")}
                  </th>
                  <th>Durum</th>
                  <th
                    onClick={() => handleSort("started_at")}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    Tarih{sortIndicator("started_at")}
                  </th>
                  <th>Süre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((g) => {
                  const s = g.latest;
                  const hasOthers = g.others.length > 0;
                  const isExpanded = expandedGroups.has(g.key);
                  return (
                    <React.Fragment key={g.key}>
                      <tr>
                        <td>
                          {hasOthers && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(g.key)}
                              aria-label={isExpanded ? "Daralt" : "Genişlet"}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                padding: 0,
                              }}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          )}
                        </td>
                        <td>
                          {toTitleCaseTR(s.user_name)}
                          {hasOthers && (
                            <span className="label" style={{ marginLeft: 6 }}>
                              ({g.others.length + 1} deneme)
                            </span>
                          )}
                        </td>
                        <td>{s.departments?.name ?? "-"}</td>
                        <td>{s.provinces?.name ?? "-"}</td>
                        <td>
                          {s.correct_count ?? "-"}/{s.total_questions}
                        </td>
                        <td>{statusBadge(s.status)}</td>
                        <td>{new Date(s.started_at).toLocaleString("tr-TR")}</td>
                        <td>{formatDuration(s.started_at, s.finished_at)}</td>
                        <td>
                          <Link href={`/admin/sonuc/${s.id}`} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "0.82rem" }}>
                            Detay
                          </Link>
                        </td>
                      </tr>
                      {isExpanded &&
                        g.others.map((o) => (
                          <tr key={o.id} style={{ background: "rgba(0,0,0,0.03)" }}>
                            <td></td>
                            <td style={{ paddingLeft: 24, opacity: 0.8 }}>{toTitleCaseTR(o.user_name)}</td>
                            <td style={{ opacity: 0.8 }}>{o.departments?.name ?? "-"}</td>
                            <td style={{ opacity: 0.8 }}>{o.provinces?.name ?? "-"}</td>
                            <td style={{ opacity: 0.8 }}>
                              {o.correct_count ?? "-"}/{o.total_questions}
                            </td>
                            <td>{statusBadge(o.status)}</td>
                            <td style={{ opacity: 0.8 }}>
                              {new Date(o.started_at).toLocaleString("tr-TR")}
                            </td>
                            <td style={{ opacity: 0.8 }}>
                              {formatDuration(o.started_at, o.finished_at)}
                            </td>
                            <td>
                              <Link href={`/admin/sonuc/${o.id}`} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "0.82rem" }}>
                                Detay
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
