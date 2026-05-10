import { NextRequest, NextResponse } from "next/server";
import { runJsonRoute } from "@/lib/api-route";
import { createProject, listProjects, type ProjectStatus, updateProject } from "@/lib/projects";

function isValidStatus(value: unknown): value is ProjectStatus {
  return value === "planned" || value === "active" || value === "blocked" || value === "done";
}

export async function GET() {
  return runJsonRoute({
    route: "projects",
    run: async () => ({ projects: await listProjects() }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.name !== "string" || typeof body.workspacePath !== "string" || typeof body.summary !== "string") {
      return NextResponse.json({ error: "name, workspacePath, and summary are required" }, { status: 400 });
    }

    const status = isValidStatus(body.status) ? body.status : "planned";
    const project = await createProject({
      name: body.name,
      workspacePath: body.workspacePath,
      repoPath: typeof body.repoPath === "string" ? body.repoPath : undefined,
      branch: typeof body.branch === "string" ? body.branch : undefined,
      status,
      progress: typeof body.progress === "number" ? body.progress : 0,
      summary: body.summary,
      nextStep: typeof body.nextStep === "string" ? body.nextStep : undefined,
      pinned: Boolean(body.pinned),
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.workspacePath === "string") patch.workspacePath = body.workspacePath;
    if (typeof body.repoPath === "string") patch.repoPath = body.repoPath;
    if (typeof body.branch === "string") patch.branch = body.branch;
    if (typeof body.summary === "string") patch.summary = body.summary;
    if (typeof body.nextStep === "string") patch.nextStep = body.nextStep;
    if (typeof body.progress === "number") patch.progress = body.progress;
    if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
    if (isValidStatus(body.status)) patch.status = body.status;

    const project = await updateProject(body.id, patch);
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
