"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/feed", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/files", label: "Files" },
  { href: "/calendar", label: "Schedule" },
  { href: "/search", label: "Search" },
  { href: "/chat", label: "Chat" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

    void check();
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void check();
      }
    }, 30_000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void check();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetTag = target instanceof HTMLElement ? target.tagName : "";
      const isTypingField =
        target instanceof HTMLElement &&
        (targetTag === "INPUT" || targetTag === "TEXTAREA" || target.isContentEditable);

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingField) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0A0F]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#2A2A3E] bg-[#1A1A2E] text-lg">
            💃
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Mission Control</p>
            <p className="text-xs text-white/45">clean, quick, useful</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-center">
          <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#2A2A3E] bg-[#1A1A2E]/70 px-3 py-2 lg:max-w-sm">
            <span className="text-sm text-white/45">🔎</span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ask Annie to find anything…"
              aria-label="Search Annie"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/35">/</span>
          </form>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-[#2A2A3E] bg-[#1A1A2E]/70 p-1">
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
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              healthy === null
                ? "bg-yellow-400"
                : healthy
                  ? "bg-[#34D399] shadow-[0_0_16px_rgba(52,211,153,0.8)]"
                  : "bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.75)]"
            }`}
          />
          {healthy === null ? "Checking Annie" : healthy ? "Annie online" : "Annie offline"}
        </div>
      </div>
    </header>
  );
}
