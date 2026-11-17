import { useEffect, useState } from "react";
import { useSdk } from "@get-bb/plugin-sdk/app";
import { messageHits, type MessageSnippet, type SearchResponseLike } from "@/lib/archive";

/** bb's per-group cap on `threads.search` results. */
export const MESSAGE_SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

export interface MessageSearchState {
  status: "idle" | "searching" | "done" | "error";
  /** Archived thread ids bb's message search returned, with a snippet when a message matched. */
  hits: ReadonlyMap<string, MessageSnippet | null>;
  /** Archived matches bb counted, which can exceed the returned results. */
  total: number;
}

const IDLE: MessageSearchState = { status: "idle", hits: new Map(), total: 0 };

/** bb's server-side search over thread messages, debounced, archived results only. */
export function useMessageSearch(query: string): MessageSearchState {
  const sdk = useSdk();
  const [state, setState] = useState<MessageSearchState>(IDLE);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) {
      setState(IDLE);
      return;
    }
    // Drop the previous query's hits so they never show against this query.
    setState({ status: "searching", hits: new Map(), total: 0 });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      sdk.threads
        .search({ query: trimmed, limitPerGroup: String(MESSAGE_SEARCH_LIMIT), signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) return;
          const typed = response as SearchResponseLike;
          setState({ status: "done", hits: messageHits(typed), total: typed.archived.total });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: "error", hits: new Map(), total: 0 });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sdk, trimmed]);

  return state;
}
