import { useMemo, type ReactNode } from "react";
import {
  ThreadTitle,
  experimental_ThreadActionsMenu as ThreadActionsMenu,
  experimental_useThreadActions as useThreadActions,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatAge, toActionTarget, type MessageSnippet } from "@/lib/archive";
import { cn } from "@/lib/utils";

/** bb's own archive action — it labels itself "Unarchive" on an archived thread. */
const UNARCHIVE_KEYS = ["bb--core/archive"] as const;

// Row actions are always visible, muted until hovered.
const quickAction = "size-7 shrink-0 text-muted-foreground hover:text-foreground";

/** The snippet's text with bb's highlight ranges wrapped in <mark>. */
function Highlighted({ snippet }: { snippet: MessageSnippet }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  const ranges = [...snippet.highlightRanges].sort((a, b) => a.start - b.start);
  for (const { start, end } of ranges) {
    if (start < cursor || end <= start) continue;
    if (start > cursor) parts.push(snippet.text.slice(cursor, start));
    parts.push(
      <mark key={start} className="rounded-sm bg-yellow-500/25 text-inherit">
        {snippet.text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < snippet.text.length) parts.push(snippet.text.slice(cursor));
  return <p className="line-clamp-2 text-xs text-muted-foreground">{parts}</p>;
}

export function ArchiveRow({
  thread,
  now,
  snippet = null,
}: {
  thread: PluginSidebarThread;
  now: number;
  snippet?: MessageSnippet | null;
}) {
  const target = useMemo(() => toActionTarget(thread), [thread]);
  const [unarchive] = useThreadActions(target, { keys: UNARCHIVE_KEYS });
  return (
    <li className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent/50">
      <a href={thread.href} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm">
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            <ThreadTitle threadId={thread.id} />
          </span>
          {snippet === null ? null : <Highlighted snippet={snippet} />}
        </span>
        {thread.archivedAt === null ? null : (
          <span className="shrink-0 text-xs text-muted-foreground" title={new Date(thread.archivedAt).toLocaleString()}>
            {formatAge(thread.archivedAt, now)}
          </span>
        )}
      </a>
      {unarchive === undefined ? null : (
        <Button
          variant="ghost"
          size="icon"
          className={quickAction}
          aria-label={`${unarchive.action.label} ${thread.displayTitle}`}
          disabled={unarchive.action.disabled === true}
          onClick={() => void unarchive.action.run()}
        >
          <Icon name={unarchive.action.icon ?? "ArchiveRestore"} className="size-4" />
        </Button>
      )}
      <ThreadActionsMenu
        thread={target}
        align="end"
        trigger={(props) => (
          <Button {...props} variant="ghost" size="icon" className={cn(props.className, quickAction)} aria-label={`Thread actions for ${thread.displayTitle}`}>
            <Icon name="MoreHorizontal" className="size-4" />
          </Button>
        )}
      />
    </li>
  );
}
