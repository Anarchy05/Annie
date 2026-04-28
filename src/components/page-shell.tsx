import { AgentBanner } from "@/components/agent-banner";
import { NavBar } from "@/components/nav-bar";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <NavBar />
      <AgentBanner />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
