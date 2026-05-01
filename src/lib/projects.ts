import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PROJECTS_FILE = "/root/projects/mission-control/state/projects.json";

export type ProjectStatus = "planned" | "active" | "blocked" | "done";

export type ProjectEntry = {
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

type ProjectsDocument = {
  projects: ProjectEntry[];
};

const defaultProjects: ProjectEntry[] = [
  {
    id: "mission-control",
    name: "Mission Control",
    workspacePath: "/root/projects/mission-control",
    repoPath: "git@github.com:Anarchy05/Annie.git",
    branch: "main",
    status: "active",
    progress: 55,
    summary: "Control panel cleanup and operator UX improvements.",
    nextStep: "Add project/workspace management and tighter multi-project tracking.",
    updatedAt: Date.now(),
    pinned: true,
  },
];

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "planned" || value === "active" || value === "blocked" || value === "done";
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeProject(input: Partial<ProjectEntry>): ProjectEntry | null {
  const name = normalizeText(input.name);
  const workspacePath = normalizeText(input.workspacePath);
  const summary = normalizeText(input.summary);

  if (!name || !workspacePath || !summary) return null;

  return {
    id: normalizeText(input.id) || crypto.randomUUID(),
    name,
    workspacePath,
    repoPath: normalizeOptionalText(input.repoPath),
    branch: normalizeOptionalText(input.branch),
    status: isProjectStatus(input.status) ? input.status : "planned",
    progress: clampProgress(typeof input.progress === "number" ? input.progress : 0),
    summary,
    nextStep: normalizeOptionalText(input.nextStep),
    updatedAt: typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now(),
    pinned: Boolean(input.pinned),
  };
}

async function ensureFile() {
  await fs.mkdir(path.dirname(PROJECTS_FILE), { recursive: true });
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    await fs.writeFile(PROJECTS_FILE, JSON.stringify({ projects: defaultProjects }, null, 2));
  }
}

async function readDoc(): Promise<ProjectsDocument> {
  await ensureFile();

  try {
    const raw = await fs.readFile(PROJECTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectsDocument>;
    return {
      projects: Array.isArray(parsed.projects)
        ? parsed.projects
            .map((entry) => normalizeProject((entry ?? {}) as Partial<ProjectEntry>))
            .filter((entry): entry is ProjectEntry => Boolean(entry))
        : [],
    };
  } catch {
    return { projects: [...defaultProjects] };
  }
}

async function writeDoc(doc: ProjectsDocument) {
  await ensureFile();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(doc, null, 2));
}

export async function listProjects() {
  const doc = await readDoc();
  return doc.projects.sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    return b.updatedAt - a.updatedAt;
  });
}

export async function createProject(input: Omit<ProjectEntry, "id" | "updatedAt"> & { id?: string }) {
  const doc = await readDoc();
  const project = normalizeProject({ ...input, updatedAt: Date.now() });

  if (!project) {
    throw new Error("Project name, workspace path, and summary are required");
  }

  doc.projects = [project, ...doc.projects.filter((entry) => entry.id !== project.id)];
  await writeDoc(doc);
  return project;
}

export async function updateProject(id: string, patch: Partial<Omit<ProjectEntry, "id" | "updatedAt">>) {
  const doc = await readDoc();
  const index = doc.projects.findIndex((entry) => entry.id === id);
  if (index === -1) {
    throw new Error("Project not found");
  }

  const current = doc.projects[index];
  const next = normalizeProject({
    ...current,
    ...patch,
    id: current.id,
    updatedAt: Date.now(),
  });

  if (!next) {
    throw new Error("Project name, workspace path, and summary are required");
  }

  doc.projects[index] = next;
  await writeDoc(doc);
  return next;
}
