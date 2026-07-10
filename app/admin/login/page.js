"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TopbarExtras from "@/components/TopbarExtras";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Tarayıcının kayıtlı bilgileri bu alanla eşleştirip otomatik
  // doldurmasını engellemek için her sayfa yüklemesinde rastgele
  // isim/id üretiyoruz (autocomplete="off" tek başına yetmiyor).
  const [fieldSuffix] = useState(
    () => Math.random().toString(36).slice(2, 10)
  );
  const emailFieldName = `e-${fieldSuffix}`;
  const passwordFieldName = `p-${fieldSuffix}`;

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Giriş başarısız: e-posta veya şifre hatalı.");
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="mark">YEDAŞ İSG Test Platformu</span>
          <span className="sub">Yönetici Paneli</span>
        </div>
        <TopbarExtras />
      </div>

      <div className="content">
        <div className="card">
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: "auto", marginBottom: 20, padding: "8px 16px", fontSize: "0.85rem" }}
            onClick={() => router.push("/")}
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
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Geri
          </button>

          <h1 className="title">Yönetici Girişi</h1>
          <p className="subtitle">
            Sınav sonuçlarını görüntülemek için giriş yapın.
          </p>

          <form onSubmit={handleLogin} autoComplete="off">
            {/* Tarayıcıyı yanıltmak için görünmez sahte alanlar (decoy).
                Bazı tarayıcılar formdaki ilk email/password alanını
                otomatik doldurma hedefi olarak seçer; bu sahte alanlar
                o hedefi üstlenir. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              style={{ display: "none" }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              style={{ display: "none" }}
              tabIndex={-1}
              aria-hidden="true"
            />

            <label htmlFor={emailFieldName}>E-posta</label>
            <input
              id={emailFieldName}
              name={emailFieldName}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
            />

            <label htmlFor={passwordFieldName}>Şifre</label>
            <input
              id={passwordFieldName}
              name={passwordFieldName}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-1p-ignore="true"
            />

            {error && <div className="error-text">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
