import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  experimental_useSidebarThreads as useSidebarThreads,
  type PluginNavPanelProps,
} from "@get-bb/plugin-sdk/app";
import { ArchiveRow } from "@/components/archive-row";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { usePointerCoarse } from "@/components/ui/hooks/use-pointer-coarse";
import { groupArchived } from "@/lib/archive";
import { cn } from "@/lib/utils";
import { MESSAGE_SEARCH_LIMIT, useMessageSearch } from "@/hooks/use-message-search";

const ARCHIVED = { experimental_lifecycles: ["archived"] } as const;

/** The dashed box bb's own list pages use for loading and empty states. */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

/** Wall-clock time that ticks every minute, so archive ages stay current. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function ArchivePanel(_props: PluginNavPanelProps) {
  const { status, threads, projects, experimental_archived: archive } = useSidebarThreads(ARCHIVED);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Search must cover the whole archive, so keep loading pages until done.
  const hasNextPage = archive?.hasNextPage ?? false;
  const isFetching = archive?.isFetchingNextPage ?? false;
  const fetchFailed = archive?.isFetchNextPageError ?? false;
  const fetchNextPage = archive?.fetchNextPage;
  useEffect(() => {
    if (hasNextPage && !isFetching && !fetchFailed && fetchNextPage !== undefined) void fetchNextPage();
  }, [hasNextPage, isFetching, fetchFailed, fetchNextPage]);

  const all = useMemo(() => groupArchived(threads, projects, ""), [threads, projects]);
  const search = useMessageSearch(query);
  const groups = useMemo(
    () => groupArchived(threads, projects, query, search.hits),
    [threads, projects, query, search.hits],
  );
  const total = all.reduce((sum, group) => sum + group.threads.length, 0);
  const now = useNow();
  const isTouch = usePointerCoarse();

  const loading = status === "loading" || archive?.status === "loading";
  const failed = status === "error" || archive?.status === "error";

  const retryNotice =
    fetchFailed && fetchNextPage !== undefined ? (
      <div role="alert" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex-1">Some archived threads couldn't load, so search may miss them.</span>
        <Button variant="outline" size="sm" onClick={() => void fetchNextPage()}>
          Retry
        </Button>
      </div>
    ) : null;

  const searching = query.trim() !== "";
  const shown = groups.reduce((sum, group) => sum + group.threads.length, 0);
  const totalLabel = `${hasNextPage ? "At least " : ""}${total}`;
  const countLabel = searching
    ? `${shown} of ${totalLabel} archived threads match`
    : `${totalLabel} archived ${total === 1 ? "thread" : "threads"}`;

  let searchNote: string | null = null;
  if (search.status === "error") searchNote = "Message search failed, so only titles were searched.";
  else if (search.status === "done" && search.total > MESSAGE_SEARCH_LIMIT)
    searchNote = `Message search shows the first ${MESSAGE_SEARCH_LIMIT} of ${search.total} matches.`;

  let body: ReactNode;
  if (failed) body = <Notice>Couldn't load archived threads</Notice>;
  else if (loading) body = <Notice>Loading archive…</Notice>;
  else if (total === 0) body = <Notice>No archived threads</Notice>;
  else if (groups.length === 0 && search.status === "searching") body = <Notice>Searching messages…</Notice>;
  else if (groups.length === 0) body = <Notice>No archived threads match "{query.trim()}"</Notice>;
  else
    body = groups.map((group) => (
      <section key={group.projectId} className="mt-4 first:mt-0">
        <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.projectName}</h2>
        <ul>
          {group.threads.map((thread) => (
            <ArchiveRow key={thread.id} thread={thread} now={now} snippet={group.snippets.get(thread.id) ?? null} />
          ))}
        </ul>
      </section>
    ));

  return (
    <div className="h-full min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto box-border w-full max-w-3xl px-3 pb-4 pt-3">
        {/* Same band, chip and input styles as bb's ⌘K thread search. */}
        <div data-search-field className="mb-3 rounded-lg border border-border bg-background px-3 py-1">
          <div className="flex h-10 items-center gap-2">
            <span className="inline-flex h-7 shrink-0 items-center rounded-md bg-state-active pl-1.5 pr-2 text-xs text-foreground">
              <span className="mr-1.5 inline-flex size-4 shrink-0 items-center justify-center [&_[data-icon-root]]:size-3.5">
                <Icon name="Search" aria-hidden />
              </span>
              Archived
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, project, or message…"
              aria-label="Search archived threads"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:font-light placeholder:text-subtle-foreground placeholder:opacity-70 [&::-webkit-search-cancel-button]:hidden",
                isTouch && "text-base",
              )}
              // Focusing on a touch screen would pop up the on-screen keyboard.
              autoFocus={!isTouch}
            />
            {searching ? (
              <button
                type="button"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-state-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              >
                <Icon name="X" className="size-3.5" />
              </button>
            ) : null}
            {total > 0 ? (
              <span
                data-count-badge
                className="shrink-0 rounded-md bg-state-active px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground"
              >
                <span aria-hidden="true">
                  {searching ? `${shown} / ` : ""}
                  {total}
                  {hasNextPage ? "+" : ""}
                </span>
                <span className="sr-only">{countLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
        {retryNotice}
        {searchNote === null ? null : <p className="mb-3 text-xs text-muted-foreground">{searchNote}</p>}
        {body}
      </div>
    </div>
  );
}
