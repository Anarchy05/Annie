export function getParentPath(targetPath: string) {
  const trimmed = targetPath.trim();
  if (!trimmed) return "";

  const normalized = trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
  const lastSlashIndex = normalized.lastIndexOf("/");

  if (lastSlashIndex <= 0) {
    return normalized.startsWith("/") ? "/" : "";
  }

  return normalized.slice(0, lastSlashIndex);
}

export function buildPreviewFallbackMessage(targetPath: string, detail: string) {
  const fileName = targetPath.split("/").filter(Boolean).at(-1) || "that file";
  return `Couldn’t preview ${fileName}. ${detail} You can still browse the parent folder or download the file directly.`;
}
