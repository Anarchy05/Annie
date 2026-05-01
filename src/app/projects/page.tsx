"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";

type ProjectStatus = "planned" | "active" | "blocked" | "done";

type ProjectEntry = {
  id: string;
  name: string;
  workspacePath: string;
  repoPath?: string;
  branch?: string;
  status: ProjectStatus;
  progress: number;
  summary: string;
  nextStep?: string;
  updatedAt: number;
  pinned?: boolean;
};

const emptyForm = {
  name: "",
  workspacePath: "",
  repoPath: "",
  branch: "",
  status: "planned" as ProjectStatus,
  progress: 0,
  summary: "",
  nextStep: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load projects");
      const data = (await response.json()) as { projects: ProjectEntry[] };
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleCreate() {
    if (!form.name.trim() || !form.workspacePath.trim() || !form.summary.trim()) return;
    setSavingId("new");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          progress: Number(form.progress) || 0,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to create project");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingId(null);
    }
  }

  async function quickUpdate(project: ProjectEntry, patch: Partial<ProjectEntry>) {
    setSavingId(project.id);
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, ...patch }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to update project");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PageShell>
      <section className="space-y-5">
        <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Projects</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Workspaces and progress</h2>
          <p className="mt-2 text-sm text-white/65">Track multiple codebases, where they live, and what Annie should do next.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">Tracked projects</h3>
              <button onClick={() => void load()} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 hover:text-white">Refresh</button>
            </div>
            {error ? <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">{error}</div> : null}
            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 rounded-2xl border border-[#2A2A3E] bg-black/20 skeleton" />)}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-2xl border border-white/8 bg-[#0E1020] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-white">{project.name}</p>
                          {project.pinned ? <span className="rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#93C5FD]">Pinned</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>{project.workspacePath}</span>
                          <a
                            href={`/files?path=${encodeURIComponent(project.workspacePath)}`}
                            className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70 hover:text-white"
                          >
                            Open files
                          </a>
                        </div>
                        {project.repoPath ? <p className="mt-1 text-xs text-white/35">{project.repoPath}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={project.status}
                          onChange={(event) => void quickUpdate(project, { status: event.target.value as ProjectStatus })}
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                        >
                          <option value="planned">planned</option>
                          <option value="active">active</option>
                          <option value="blocked">blocked</option>
                          <option value="done">done</option>
                        </select>
                        <button
                          onClick={() => void quickUpdate(project, { pinned: !project.pinned })}
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70"
                        >
                          {project.pinned ? "Unpin" : "Pin"}
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-white/75">{project.summary}</p>
                    {project.nextStep ? <p className="mt-2 text-sm text-[#93C5FD]">Next: {project.nextStep}</p> : null}

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-white/45">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-[#60A5FA]" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {[0, 25, 50, 75, 100].map((value) => (
                        <button
                          key={value}
                          onClick={() => void quickUpdate(project, { progress: value })}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/70 hover:text-white"
                        >
                          {value}%
                        </button>
                      ))}
                      {project.branch ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">Branch {project.branch}</span> : null}
                      <span className="text-xs text-white/35">Updated {new Date(project.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {!projects.length ? <p className="text-sm text-white/45">No projects yet.</p> : null}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[#2A2A3E] bg-[#1A1A2E]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <h3 className="text-base font-semibold text-white">Add project</h3>
            <div className="mt-4 space-y-3">
              <Input label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
              <Input label="Workspace path" value={form.workspacePath} onChange={(value) => setForm((current) => ({ ...current, workspacePath: value }))} placeholder="/root/projects/another-app" />
              <Input label="Repo path" value={form.repoPath} onChange={(value) => setForm((current) => ({ ...current, repoPath: value }))} placeholder="git@github.com:..." />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Branch" value={form.branch} onChange={(value) => setForm((current) => ({ ...current, branch: value }))} placeholder="main" />
                <label className="block text-sm text-white/70">
                  <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-white/40">Status</span>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))} className="w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none">
                    <option value="planned">planned</option>
                    <option value="active">active</option>
                    <option value="blocked">blocked</option>
                    <option value="done">done</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm text-white/70">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-white/40">Summary</span>
                <textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} className="min-h-24 w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-white/70">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-white/40">Next step</span>
                <textarea value={form.nextStep} onChange={(event) => setForm((current) => ({ ...current, nextStep: event.target.value }))} className="min-h-20 w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none" />
              </label>
              <label className="block text-sm text-white/70">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-white/40">Progress</span>
                <input type="range" min="0" max="100" step="5" value={form.progress} onChange={(event) => setForm((current) => ({ ...current, progress: Number(event.target.value) }))} className="w-full" />
                <p className="mt-1 text-xs text-white/45">{form.progress}%</p>
              </label>
              <button onClick={() => void handleCreate()} disabled={savingId === "new"} className="w-full rounded-2xl bg-[#60A5FA] px-5 py-3 text-sm font-medium text-[#0A0A0F] disabled:opacity-50">
                {savingId === "new" ? "Saving…" : "Add project"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm text-white/70">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-white/40">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-[#2A2A3E] bg-[#0E1020] px-4 py-3 text-white outline-none placeholder:text-white/25" />
    </label>
  );
}
