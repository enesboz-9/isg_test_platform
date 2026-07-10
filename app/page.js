"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toTitleCaseTR } from "@/lib/formatName";
import TopbarExtras from "@/components/TopbarExtras";

export default function HomePage() {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);

  useEffect(() => {
    async function loadLists() {
      const [{ data: deps, error: depErr }, { data: provs, error: provErr }] =
        await Promise.all([
          supabase.from("departments").select("id, name").order("name"),
          supabase.from("provinces").select("id, name").order("name"),
        ]);
      if (!depErr) setDepartments(deps ?? []);
      if (!provErr) setProvinces(provs ?? []);
      setLoadingLists(false);
    }
    loadLists();
  }, []);

  async function handleStart(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Lütfen adınızı ve soyadınızı girin.");
      return;
    }
    if (!departmentId) {
      setError("Lütfen departmanınızı seçin.");
      return;
    }
    if (!provinceId) {
      setError("Lütfen görev yaptığınız ili seçin.");
      return;
    }

    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("start_test_session", {
      p_user_name: toTitleCaseTR(name),
      p_department_id: Number(departmentId),
      p_province_id: Number(provinceId),
    });

    if (rpcError) {
      setError("Test başlatılamadı: " + rpcError.message);
      setLoading(false);
      return;
    }

    router.push(`/test?session=${data}`);
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">İSG Değerlendirme Testi</span>
          <span className="sub">YEDAŞ · İş Sağlığı ve Güvenliği</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            className="admin-link"
            onClick={() => router.push("/admin/login")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Yönetici Girişi
          </button>
          <TopbarExtras />
        </div>
      </div>

      <div className="content">
        <div className="card">
          <h1 className="title">Teste Başlamadan Önce</h1>
          <p className="subtitle">
            Bilgilerinizi eksiksiz girin. Test, soru havuzundan rastgele
            seçilen 20 sorudan oluşur ve 30 dakika süre ile sınırlıdır. Süre
            dolduğunda test otomatik olarak sonlanır.
          </p>

          <form onSubmit={handleStart}>
            <label htmlFor="name">Ad Soyad</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ahmet Yılmaz"
              autoComplete="off"
            />

            <label htmlFor="department">Departman</label>
            <select
              id="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={loadingLists}
            >
              <option value="">Seçiniz</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <label htmlFor="province">Görev Yaptığınız İl</label>
            <select
              id="province"
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
              disabled={loadingLists}
            >
              <option value="">Seçiniz</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {error && <div className="error-text">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Başlatılıyor..." : "Teste Başla"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
