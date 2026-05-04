export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type MarkdownBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "blockquote"; text: string }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "code"; content: string; language?: string };

const CODE_FENCE_REGEX = /```([\w-]+)?\n([\s\S]*?)```/g;
const MARKDOWN_LINK_REGEX = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i;
const BARE_URL_REGEX = /^(https?:\/\/[^\s<]+[^\s<.,;:!?])/i;
const INLINE_CODE_REGEX = /^`([^`]+)`/;
const TABLE_SEPARATOR_REGEX = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;
const LIST_ITEM_REGEX = /^\s*([-*]|\d+\.)\s+/;

export function splitMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_FENCE_REGEX.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) {
      blocks.push(...parseTextBlocks(before));
    }

    blocks.push({
      kind: "code",
      language: match[1],
      content: match[2].trimEnd(),
    });

    lastIndex = CODE_FENCE_REGEX.lastIndex;
  }

  const tail = text.slice(lastIndex).trim();
  if (tail) {
    blocks.push(...parseTextBlocks(tail));
  }

  return blocks.length ? blocks : [{ kind: "paragraph", text }];
}

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  while (remaining) {
    const next = findNextInlineMatch(remaining);
    if (!next) {
      tokens.push({ type: "text", text: remaining });
      break;
    }

    if (next.index > 0) {
      tokens.push({ type: "text", text: remaining.slice(0, next.index) });
    }

    const segment = remaining.slice(next.index);
    if (next.type === "code") {
      const match = segment.match(INLINE_CODE_REGEX);
      if (match) {
        tokens.push({ type: "code", text: match[1] });
        remaining = segment.slice(match[0].length);
        continue;
      }
    }

    if (next.type === "markdown-link") {
      const match = segment.match(MARKDOWN_LINK_REGEX);
      if (match) {
        tokens.push({ type: "link", text: match[1], href: match[2] });
        remaining = segment.slice(match[0].length);
        continue;
      }
    }

    if (next.type === "bare-url") {
      const match = segment.match(BARE_URL_REGEX);
      if (match) {
        tokens.push({ type: "link", text: match[1], href: match[1] });
        remaining = segment.slice(match[0].length);
        continue;
      }
    }

    tokens.push({ type: "text", text: segment[0] });
    remaining = segment.slice(1);
  }

  return mergeTextTokens(tokens);
}

function parseTextBlocks(text: string): MarkdownBlock[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseParagraphBlock(part));
}

function parseParagraphBlock(text: string): MarkdownBlock {
  const lines = text.split("\n");
  const heading = text.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    return {
      kind: "heading",
      level: heading[1].length as 1 | 2 | 3,
      text: heading[2].trim(),
    };
  }

  if (isTable(lines)) {
    const [headerLine, , ...rowLines] = lines;
    return {
      kind: "table",
      headers: splitTableRow(headerLine),
      rows: rowLines.map((line) => splitTableRow(line)),
    };
  }

  if (lines.every((line) => LIST_ITEM_REGEX.test(line))) {
    return {
      kind: "list",
      items: lines.map((line) => line.replace(LIST_ITEM_REGEX, "").trim()),
    };
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    return {
      kind: "blockquote",
      text: lines.map((line) => line.replace(/^>\s?/, "")).join("\n").trim(),
    };
  }

  return { kind: "paragraph", text };
}

function isTable(lines: string[]) {
  return lines.length >= 2 && lines[0].includes("|") && TABLE_SEPARATOR_REGEX.test(lines[1]);
}

function splitTableRow(line: string) {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function findNextInlineMatch(text: string) {
  const candidates = [
    { type: "code" as const, index: text.search(/`[^`]+`/) },
    { type: "markdown-link" as const, index: text.search(/\[[^\]]+\]\(https?:\/\/[^\s)]+\)/i) },
    { type: "bare-url" as const, index: text.search(/https?:\/\//i) },
  ].filter((candidate) => candidate.index >= 0);

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.index - b.index);
  return candidates[0];
}

function mergeTextTokens(tokens: InlineToken[]) {
  return tokens.reduce<InlineToken[]>((result, token) => {
    if (token.type !== "text") {
      result.push(token);
      return result;
    }

    const previous = result.at(-1);
    if (previous?.type === "text") {
      previous.text += token.text;
      return result;
    }

    result.push(token);
    return result;
  }, []);
}
