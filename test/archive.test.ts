import { describe, expect, it } from "vitest";
import { formatAge, groupArchived, messageHits, toActionTarget, UNKNOWN_PROJECT, type SearchResponseLike } from "../lib/archive";
import { DAY, NOW, project, thread } from "./fixtures";

const projects = [project("p-web", "web"), project("p-api", "api")];

const titles = (groups: ReturnType<typeof groupArchived>) =>
  groups.map((group) => [group.projectName, group.threads.map((t) => t.displayTitle)]);

describe("groupArchived", () => {
  it("groups by project A–Z, newest archived first within a group", () => {
    const groups = groupArchived(
      [
        thread({ id: "a", projectId: "p-web", title: "older", archivedAt: NOW - 5 * DAY }),
        thread({ id: "b", projectId: "p-api", title: "login bug", archivedAt: NOW - 3 * DAY }),
        thread({ id: "c", projectId: "p-web", title: "newer", archivedAt: NOW - DAY }),
      ],
      projects,
      "",
    );
    expect(titles(groups)).toEqual([
      ["api", ["login bug"]],
      ["web", ["newer", "older"]],
    ]);
  });

  it("leaves out active and hidden threads", () => {
    const groups = groupArchived(
      [
        thread({ id: "a", projectId: "p-web", title: "active", isArchived: false, archivedAt: null }),
        thread({ id: "b", projectId: "p-web", title: "hidden", isHidden: true }),
        thread({ id: "c", projectId: "p-web", title: "kept" }),
      ],
      projects,
      "",
    );
    expect(titles(groups)).toEqual([["web", ["kept"]]]);
  });

  it("puts threads of an unknown project in a last group", () => {
    const groups = groupArchived(
      [
        thread({ id: "a", projectId: "p-gone", title: "orphan" }),
        thread({ id: "b", projectId: "p-web", title: "known" }),
        thread({ id: "c", projectId: "p-gone-too", title: "orphan 2", archivedAt: NOW - 2 * DAY }),
      ],
      projects,
      "",
    );
    expect(titles(groups)).toEqual([
      ["web", ["known"]],
      [UNKNOWN_PROJECT, ["orphan", "orphan 2"]],
    ]);
    expect(UNKNOWN_PROJECT).toBe("Unknown project");
  });

  it("matches titles case-insensitively with surrounding spaces ignored", () => {
    const groups = groupArchived(
      [
        thread({ id: "a", projectId: "p-web", title: "Fix login bug" }),
        thread({ id: "b", projectId: "p-web", title: "Deploy" }),
      ],
      projects,
      "  LOGIN ",
    );
    expect(titles(groups)).toEqual([["web", ["Fix login bug"]]]);
  });

  it("returns a project's whole group when the query matches its name", () => {
    const groups = groupArchived(
      [
        thread({ id: "a", projectId: "p-api", title: "one" }),
        thread({ id: "b", projectId: "p-api", title: "two", archivedAt: NOW - 2 * DAY }),
        thread({ id: "c", projectId: "p-web", title: "three" }),
      ],
      projects,
      "api",
    );
    expect(titles(groups)).toEqual([["api", ["one", "two"]]]);
  });

  it("searches the display title of an untitled thread", () => {
    const groups = groupArchived(
      [thread({ id: "a", projectId: "p-web", title: null, displayTitle: "Untitled thread" })],
      projects,
      "untitled",
    );
    expect(titles(groups)).toEqual([["web", ["Untitled thread"]]]);
  });

  it("returns nothing when nothing matches, everything for an empty query", () => {
    const threads = [thread({ id: "a", projectId: "p-web", title: "x" })];
    expect(groupArchived(threads, projects, "zzz")).toEqual([]);
    expect(groupArchived(threads, projects, "   ")).toHaveLength(1);
  });
});

describe("formatAge", () => {
  it("formats how long ago a thread was archived", () => {
    const MIN = 60 * 1000;
    expect(formatAge(NOW - 30 * 1000, NOW)).toBe("now");
    expect(formatAge(NOW - 5 * MIN, NOW)).toBe("5m");
    expect(formatAge(NOW - 3 * 60 * MIN, NOW)).toBe("3h");
    expect(formatAge(NOW - 2 * DAY, NOW)).toBe("2d");
    expect(formatAge(NOW - 15 * DAY, NOW)).toBe("2w");
    expect(formatAge(NOW - 60 * DAY, NOW)).toBe("2mo");
    expect(formatAge(NOW - 800 * DAY, NOW)).toBe("2y");
    expect(formatAge(NOW + MIN, NOW)).toBe("now");
  });
});

describe("toActionTarget", () => {
  it("passes the fields bb's thread actions read", () => {
    const t = thread({ id: "a", projectId: "p-web", sectionId: "s1", isUnread: true });
    expect(toActionTarget(t)).toEqual({
      id: "a",
      projectId: "p-web",
      parentThreadId: null,
      parentNotifications: "auto",
      archivedAt: t.archivedAt,
      pinnedAt: null,
      sectionId: "s1",
      isUnread: true,
      status: "idle",
      environment: null,
    });
  });

  it("keeps a reusable environment and drops one without an id", () => {
    const env = { name: "e", branchName: null, isWorktree: true, providerId: null, workspaceDisplayKind: null };
    const withId = thread({ id: "a", environment: { ...env, id: "env1", path: "/w" } });
    const withoutId = thread({ id: "b", environment: { ...env, id: null, path: "/w" } });
    expect(toActionTarget(withId).environment).toEqual({ id: "env1", path: "/w" });
    expect(toActionTarget(withoutId).environment).toBeNull();
  });
});

const response = (
  results: { id: string; matches: { sourceKind: string; text: string; highlightRanges?: { start: number; end: number }[] }[] }[],
  total = results.length,
): SearchResponseLike & { active: unknown } => ({
  active: { total: 1, results: [{ thread: { id: "active-1" }, matches: [{ sourceKind: "user_message", text: "x", highlightRanges: [] }] }] },
  archived: {
    total,
    results: results.map((r) => ({
      thread: { id: r.id },
      matches: r.matches.map((m) => ({ highlightRanges: [], ...m })),
    })),
  },
});

describe("messageHits", () => {
  it("maps archived results to their first message snippet, ignoring active threads", () => {
    const hits = messageHits(
      response([
        {
          id: "a",
          matches: [
            { sourceKind: "title", text: "the title" },
            { sourceKind: "assistant_message", text: "needs Firestore", highlightRanges: [{ start: 6, end: 15 }] },
          ],
        },
        { id: "b", matches: [{ sourceKind: "title_fallback", text: "only title" }] },
      ]),
    );
    expect([...hits.keys()]).toEqual(["a", "b"]);
    expect(hits.get("a")).toEqual({ text: "needs Firestore", highlightRanges: [{ start: 6, end: 15 }] });
    expect(hits.get("b")).toBeNull();
  });
});

describe("groupArchived with message hits", () => {
  const hits = new Map([
    ["m1", { text: "…Firestore…", highlightRanges: [{ start: 1, end: 10 }] }],
    ["t1", { text: "also in messages", highlightRanges: [] }],
    ["hidden", { text: "x", highlightRanges: [] }],
    ["not-loaded", { text: "x", highlightRanges: [] }],
  ]);
  const threads = [
    thread({ id: "m1", projectId: "p-web", title: "how is it going", archivedAt: NOW - DAY }),
    thread({ id: "t1", projectId: "p-web", title: "Firestore rules", archivedAt: NOW - 5 * DAY }),
    thread({ id: "hidden", projectId: "p-web", title: "h", isHidden: true }),
    thread({ id: "other", projectId: "p-web", title: "unrelated" }),
  ];

  it("adds message-only matches after title matches, with their snippet", () => {
    const [group] = groupArchived(threads, projects, "firestore", hits);
    expect(group!.threads.map((t) => t.id)).toEqual(["t1", "m1"]);
    expect(group!.snippets.get("m1")).toEqual(hits.get("m1"));
    expect(group!.snippets.has("t1")).toBe(false);
  });

  it("ignores hits for hidden or unloaded threads and for an empty query", () => {
    const [group] = groupArchived(threads, projects, "firestore", hits);
    expect(group!.threads.map((t) => t.id)).not.toContain("hidden");
    expect(groupArchived(threads, projects, "", hits)[0]!.snippets.size).toBe(0);
  });
});
