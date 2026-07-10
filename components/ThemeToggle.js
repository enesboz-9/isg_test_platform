"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("isg-theme", next);
    } catch (e) {
      // localStorage erişilemezse sessizce yoksay
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Tema değiştir"
      title={theme === "dark" ? "Açık moda geç" : "Koyu moda geç"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
