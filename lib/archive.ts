import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginThreadActionTarget,
} from "@get-bb/plugin-sdk/app";

export interface MessageSnippet {
  text: string;
  highlightRanges: readonly { start: number; end: number }[];
}

export interface ArchiveGroup {
  projectId: string;
  projectName: string;
  /** Title/project matches first, then message-only matches; each newest archived first. */
  threads: PluginSidebarThread[];
  /** Snippets for threads that matched only through their messages. */
  snippets: ReadonlyMap<string, MessageSnippet>;
}

/** The part of bb's `threads.search` response this page reads. */
export interface SearchResponseLike {
  archived: {
    total: number;
    results: readonly {
      thread: { id: string };
      matches: readonly { sourceKind: string; text: string; highlightRanges: readonly { start: number; end: number }[] }[];
    }[];
  };
}

/** Group name for archived threads whose project no longer exists. */
export const UNKNOWN_PROJECT = "Unknown project";
const UNKNOWN_KEY = "__unknown__";
const TITLE_KINDS = new Set(["title", "title_fallback"]);

/** Archived search results by thread id, each with its first message snippet (null when only the title matched). */
export function messageHits(response: SearchResponseLike): Map<string, MessageSnippet | null> {
  const hits = new Map<string, MessageSnippet | null>();
  for (const result of response.archived.results) {
    const match = result.matches.find((m) => !TITLE_KINDS.has(m.sourceKind));
    hits.set(result.thread.id, match === undefined ? null : { text: match.text, highlightRanges: match.highlightRanges });
  }
  return hits;
}

const newestFirst = (a: PluginSidebarThread, b: PluginSidebarThread) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0);

/**
 * Archived, visible threads grouped by project (A–Z, unknown project last).
 * A thread matches when `query` (case-insensitive, trimmed) is in its display
 * title or project name, or when bb's message search returned it in `hits`.
 */
export function groupArchived(
  threads: readonly PluginSidebarThread[],
  projects: readonly PluginSidebarProject[],
  query: string,
  hits: ReadonlyMap<string, MessageSnippet | null> = new Map(),
): ArchiveGroup[] {
  const needle = query.trim().toLowerCase();
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const groups = new Map<string, { group: ArchiveGroup; titled: PluginSidebarThread[]; messaged: PluginSidebarThread[]; snippets: Map<string, MessageSnippet> }>();

  for (const thread of threads) {
    if (!thread.isArchived || thread.isHidden) continue;
    const projectName = names.get(thread.projectId) ?? UNKNOWN_PROJECT;
    const titleMatch =
      needle === "" ||
      thread.displayTitle.toLowerCase().includes(needle) ||
      projectName.toLowerCase().includes(needle);
    const messageMatch = !titleMatch && needle !== "" && hits.has(thread.id);
    if (!titleMatch && !messageMatch) continue;
    // Every deleted project shares the one "Unknown project" group.
    const key = names.has(thread.projectId) ? thread.projectId : UNKNOWN_KEY;
    let entry = groups.get(key);
    if (entry === undefined) {
      const snippets = new Map<string, MessageSnippet>();
      entry = { group: { projectId: key, projectName, threads: [], snippets }, titled: [], messaged: [], snippets };
      groups.set(key, entry);
    }
    if (titleMatch) entry.titled.push(thread);
    else {
      entry.messaged.push(thread);
      const snippet = hits.get(thread.id);
      if (snippet) entry.snippets.set(thread.id, snippet);
    }
  }

  const known = (g: ArchiveGroup) => names.has(g.projectId);
  return [...groups.values()]
    .map(({ group, titled, messaged }) => ({
      ...group,
      threads: [...titled.sort(newestFirst), ...messaged.sort(newestFirst)],
    }))
    .sort((a, b) => {
      if (known(a) !== known(b)) return known(a) ? -1 : 1;
      return a.projectName.localeCompare(b.projectName);
    });
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact age like bb's sidebar: now, 5m, 3h, 2d, 2w, 2mo, 2y. */
export function formatAge(at: number, now: number): string {
  const elapsed = now - at;
  if (elapsed < MINUTE) return "now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / (7 * DAY))}w`;
  if (elapsed < 365 * DAY) return `${Math.floor(elapsed / (30 * DAY))}mo`;
  return `${Math.floor(elapsed / (365 * DAY))}y`;
}

/** The subset of a sidebar thread bb's thread actions and menu read. */
export function toActionTarget(thread: PluginSidebarThread): PluginThreadActionTarget {
  const env = thread.environment;
  return {
    id: thread.id,
    projectId: thread.projectId,
    parentThreadId: thread.parentThreadId,
    parentNotifications: thread.parentNotifications,
    archivedAt: thread.archivedAt,
    pinnedAt: thread.pinnedAt,
    sectionId: thread.sectionId,
    isUnread: thread.isUnread,
    status: thread.status,
    environment: env !== null && env.id !== null ? { id: env.id, path: env.path } : null,
  };
}
