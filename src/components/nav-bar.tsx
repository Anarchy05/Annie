"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/feed", label: "Feed" },
  { href: "/calendar", label: "Calendar" },
  { href: "/search", label: "Search" },
  { href: "/chat", label: "Chat" },
];

export function NavBar() {
  const pathname = usePathname();
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const data = (await response.json()) as { ok: boolean };
        if (mounted) setHealthy(Boolean(data.ok));
      } catch {
        if (mounted) setHealthy(false);
      }
    };

    check();
    const interval = window.setInterval(check, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2A2A3E] bg-[#1A1A2E] text-xl shadow-[0_0_30px_rgba(96,165,250,0.15)]">
            🦀
          </div>
          <div>
            <p className="text-sm font-medium text-white">Annie&apos;s Mission Control</p>
            <p className="text-xs text-white/45">Personal ops dashboard</p>
          </div>
        </div>

        <nav className="flex items-center gap-2 rounded-full border border-[#2A2A3E] bg-[#1A1A2E]/70 p-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-[#60A5FA] text-[#0A0A0F]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-sm text-white/70">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              healthy === null
                ? "bg-yellow-400"
                : healthy
                  ? "bg-[#34D399] shadow-[0_0_18px_rgba(52,211,153,0.85)]"
                  : "bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.75)]"
            }`}
          />
          Gateway {healthy === null ? "checking" : healthy ? "online" : "offline"}
        </div>
      </div>
    </header>
  );
}
