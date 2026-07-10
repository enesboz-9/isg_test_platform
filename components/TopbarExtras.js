"use client";

import ThemeToggle from "./ThemeToggle";

export default function TopbarExtras() {
  return (
    <div className="topbar-extras">
      <span className="dev-credit">Geliştirici: Enes BOZ</span>
      <ThemeToggle />
    </div>
  );
}
