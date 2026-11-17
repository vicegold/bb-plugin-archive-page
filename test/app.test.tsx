// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { PluginThreadActionEntry } from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { NOW, project, sidebarState, thread } from "./fixtures";

const app = await loadPluginApp(() => import("../app"));
const panel = () => app.navPanels[0]!;
const ownText = (text: string) => (_: string, el: Element | null) => el?.textContent === text;

afterEach(cleanup);

describe("Archive nav panel", () => {
  it("registers one Archive destination in the rail", () => {
    expect(app.navPanels).toHaveLength(1);
    expect(panel()).toMatchObject({ id: "archive", path: "archive", icon: "Archive", title: "Archive" });
  });

  it("says so when nothing is archived", async () => {
    const slot = renderSlot(panel(), { subPath: "" }, { sidebarThreads: sidebarState() });
    expect(await slot.findByText("No archived threads")).toBeTruthy();
  });
});

describe("Archive list", () => {
  const projects = [project("p-web", "web"), project("p-api", "api")];
  const threads = [
    thread({ id: "t1", projectId: "p-web", title: "status on this?" }),
    thread({ id: "t2", projectId: "p-api", title: "Fix login bug" }),
  ];
  const unarchiveEntry = (run: () => Promise<void>, disabled = false): PluginThreadActionEntry => ({
    key: "bb--core/archive",
    pluginId: "bb--core",
    group: "lifecycle",
    action: { label: "Unarchive", icon: "ArchiveRestore", run, disabled } as PluginThreadActionEntry["action"],
  });
  const render = (
    state = sidebarState({ threads, projects }),
    run: () => Promise<void> = async () => {},
    disabled = false,
  ) =>
    renderSlot(panel(), { subPath: "" }, {
      sidebarThreads: state,
      threadActions: (_thread, _options) => [unarchiveEntry(run, disabled)],
      sdk: { threads: { search: async () => ({ active: { total: 0, results: [] }, archived: { total: 0, results: [] } }) } } as never,
    });
  const one = () => sidebarState({ threads: [threads[0]!], projects });

  it("lists threads under project headings in A–Z order", async () => {
    const slot = render();
    const headings = await slot.findAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(["api", "web"]);
    expect(slot.getByText("Fix login bug")).toBeTruthy();
    expect(slot.getByText("status on this?")).toBeTruthy();
  });

  it("filters as you type", async () => {
    const slot = render();
    fireEvent.change(await slot.findByLabelText("Search archived threads"), { target: { value: "login" } });
    expect(slot.getByText("Fix login bug")).toBeTruthy();
    expect(slot.queryByText("status on this?")).toBeNull();
  });

  it("says when the search matches nothing", async () => {
    const slot = render();
    fireEvent.change(await slot.findByLabelText("Search archived threads"), { target: { value: "zzz" } });
    expect(await slot.findByText('No archived threads match "zzz"')).toBeTruthy();
  });

  it("runs bb's Unarchive action from the row button", async () => {
    const run = vi.fn(async () => {});
    const slot = render(sidebarState({ threads: [threads[0]!], projects }), run);
    fireEvent.click(await slot.findByRole("button", { name: "Unarchive status on this?" }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("always shows both row buttons, not only on hover", async () => {
    const slot = render(one());
    const unarchive = await slot.findByRole("button", { name: "Unarchive status on this?" });
    const menu = slot.getByRole("button", { name: "Thread actions for status on this?" });
    for (const button of [unarchive, menu]) expect(button.className.split(/\s+/)).not.toContain("opacity-0");
  });

  it("offers bb's thread menu on every row", async () => {
    const slot = render(sidebarState({ threads: [threads[0]!], projects }));
    expect(await slot.findByRole("button", { name: "Thread actions for status on this?" })).toBeTruthy();
  });

  it("loads every page of the archive so search covers it all", async () => {
    const fetchNextPage = vi.fn(async () => {});
    render(sidebarState({ threads, projects, archived: { hasNextPage: true, fetchNextPage } }));
    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });

  it("shows loading and error states", async () => {
    expect(await render(sidebarState({ status: "loading" })).findByText("Loading archive…")).toBeTruthy();
    expect(
      await render(sidebarState({ archived: { status: "error" } })).findByText("Couldn't load archived threads"),
    ).toBeTruthy();
  });

  it("names each row's buttons after its thread", async () => {
    const slot = render();
    expect(await slot.findByRole("button", { name: "Unarchive Fix login bug" })).toBeTruthy();
    expect(slot.getByRole("button", { name: "Thread actions for Fix login bug" })).toBeTruthy();
  });

  it("disables Unarchive while bb disables the action", async () => {
    const run = vi.fn(async () => {});
    const slot = render(one(), run, true);
    const button = (await slot.findByRole("button", { name: "Unarchive status on this?" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(run).not.toHaveBeenCalled();
  });

  it("does not fetch another page while one is loading", async () => {
    const fetchNextPage = vi.fn(async () => {});
    render(sidebarState({ threads, projects, archived: { hasNextPage: true, isFetchingNextPage: true, fetchNextPage } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("stops paging after a failed page and offers a retry", async () => {
    const fetchNextPage = vi.fn(async () => {});
    const slot = render(
      sidebarState({ threads, projects, archived: { hasNextPage: true, isFetchNextPageError: true, fetchNextPage } }),
    );
    expect(await slot.findByText("Some archived threads couldn't load, so search may miss them.")).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
    fireEvent.click(slot.getByRole("button", { name: "Retry" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("announces the archive size in words", async () => {
    const slot = render();
    expect(await slot.findByText(ownText("2 archived threads"))).toBeTruthy();
    cleanup();
    const more = render(sidebarState({ threads, projects, archived: { hasNextPage: true } }));
    expect(await more.findByText(ownText("At least 2 archived threads"))).toBeTruthy();
    cleanup();
    expect(await render(one()).findByText(ownText("1 archived thread"))).toBeTruthy();
  });

  it("refreshes archive ages every minute", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    try {
      const slot = render(sidebarState({ threads: [thread({ id: "t9", projectId: "p-web", title: "x", archivedAt: NOW - 30_000 })], projects }));
      expect(slot.getByText("now")).toBeTruthy();
      act(() => vi.advanceTimersByTime(2 * 60_000));
      expect(slot.getByText("2m")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("focuses search on desktop but not on touch screens", async () => {
    const slot = render();
    expect(document.activeElement).toBe(await slot.findByLabelText("Search archived threads"));
    cleanup();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    try {
      const touch = render();
      expect(document.activeElement).not.toBe(await touch.findByLabelText("Search archived threads"));
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("Full-text search", () => {
  const projects = [project("p-web", "web")];
  const threads = [
    thread({ id: "m1", projectId: "p-web", title: "how is it going", archivedAt: NOW - 1000 }),
    thread({ id: "t1", projectId: "p-web", title: "Firestore rules", archivedAt: NOW - 5000 }),
  ];
  const archivedResults = (total = 1) => ({
    active: { total: 0, results: [] },
    archived: {
      total,
      results: [
        {
          thread: { id: "m1" },
          matches: [
            { sourceKind: "assistant_message", text: "If a task needs Firestore data", highlightRanges: [{ start: 16, end: 25 }], sourceSeq: 46 },
          ],
        },
      ],
    },
  });
  const render = (search: (args: { query: string; limitPerGroup?: string }) => Promise<unknown>) =>
    renderSlot(panel(), { subPath: "" }, {
      sidebarThreads: sidebarState({ threads, projects }),
      threadActions: () => [],
      sdk: { threads: { search } } as never,
    });
  const type = async (slot: ReturnType<typeof render>, value: string) =>
    fireEvent.change(await slot.findByLabelText("Search archived threads"), { target: { value } });

  it("finds threads by their messages and shows the matching text", async () => {
    const search = vi.fn(async () => archivedResults());
    const slot = render(search);
    await type(slot, "firestore");
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: "firestore", limitPerGroup: "50" })));
    const mark = await slot.findByText("Firestore", { selector: "mark" });
    expect(mark.parentElement?.textContent).toBe("If a task needs Firestore data");
    expect(slot.getByText("how is it going")).toBeTruthy();
  });

  it("lists title matches before message matches", async () => {
    const slot = render(async () => archivedResults());
    await type(slot, "firestore");
    await slot.findByText("Firestore", { selector: "mark" });
    const rows = slot.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("Firestore rules");
    expect(rows[1]).toContain("how is it going");
  });

  it("waits for message search before saying nothing matches", async () => {
    let resolve!: (value: unknown) => void;
    const search = vi.fn(() => new Promise((r) => (resolve = r)));
    const slot = render(search);
    await type(slot, "zzz");
    expect(await slot.findByText("Searching messages…")).toBeTruthy();
    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(slot.queryByText('No archived threads match "zzz"')).toBeNull();
    await act(async () => resolve({ active: { total: 0, results: [] }, archived: { total: 0, results: [] } }));
    expect(await slot.findByText('No archived threads match "zzz"')).toBeTruthy();
  });

  it("says when message results were capped", async () => {
    const slot = render(async () => archivedResults(120));
    await type(slot, "firestore");
    expect(await slot.findByText("Message search shows the first 50 of 120 matches.")).toBeTruthy();
  });

  it("keeps title matches when message search fails", async () => {
    const slot = render(async () => {
      throw new Error("boom");
    });
    await type(slot, "firestore");
    expect(await slot.findByText("Message search failed, so only titles were searched.")).toBeTruthy();
    expect(slot.getByText("Firestore rules")).toBeTruthy();
  });

  it("does not search messages for a single character", async () => {
    const search = vi.fn(async () => archivedResults());
    const slot = render(search);
    await type(slot, "f");
    await new Promise((r) => setTimeout(r, 400));
    expect(search).not.toHaveBeenCalled();
  });
});

describe("Search field", () => {
  const projects = [project("p-web", "web"), project("p-api", "api")];
  const threads = [
    thread({ id: "t1", projectId: "p-web", title: "status on this?" }),
    thread({ id: "t2", projectId: "p-api", title: "Fix login bug" }),
  ];
  const render = () =>
    renderSlot(panel(), { subPath: "" }, {
      sidebarThreads: sidebarState({ threads, projects }),
      threadActions: () => [],
      sdk: { threads: { search: async () => ({ active: { total: 0, results: [] }, archived: { total: 0, results: [] } }) } } as never,
    });

  it("shows the count as a badge inside the search field", async () => {
    const slot = render();
    const input = await slot.findByLabelText("Search archived threads");
    const field = input.closest("[data-search-field]");
    expect(field).not.toBeNull();
    expect(field!.querySelector("[data-count-badge]")?.textContent).toContain("2");
  });

  it("shows matches out of the total while searching", async () => {
    const slot = render();
    fireEvent.change(await slot.findByLabelText("Search archived threads"), { target: { value: "login" } });
    expect(await slot.findByText(ownText("1 of 2 archived threads match"))).toBeTruthy();
  });

  it("clears the search with the clear button", async () => {
    const slot = render();
    expect(slot.queryByRole("button", { name: "Clear search" })).toBeNull();
    const input = (await slot.findByLabelText("Search archived threads")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "login" } });
    fireEvent.click(slot.getByRole("button", { name: "Clear search" }));
    expect(input.value).toBe("");
    expect(slot.getByText("status on this?")).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });
});

