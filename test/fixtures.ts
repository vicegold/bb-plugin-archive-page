import type {
  PluginSidebarProject,
  PluginSidebarThread,
  PluginSidebarThreadsState,
} from "@get-bb/plugin-sdk/app";

const DAY = 24 * 60 * 60 * 1000;
export const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

/** A sidebar thread with every required field filled; override what a test cares about. */
export function thread(overrides: Partial<PluginSidebarThread> & { id: string }): PluginSidebarThread {
  const title = overrides.title === undefined ? `Thread ${overrides.id}` : overrides.title;
  return {
    projectId: "p1",
    href: `/threads/${overrides.id}`,
    title,
    titleFallback: "Untitled thread",
    displayTitle: title ?? "Untitled thread",
    parentThreadId: null,
    parentNotifications: "auto",
    lifecycleOwnerThreadId: null,
    sourceThreadId: null,
    sectionId: null,
    originKind: "user",
    originPluginId: null,
    providerId: "claude-code",
    status: "idle",
    runtimeStatus: "idle",
    queuedWork: "none",
    hasPendingInteraction: false,
    activity: null,
    isUnread: false,
    isPinned: false,
    pinnedAt: null,
    isArchived: true,
    archivedAt: NOW - DAY,
    pinSortKey: null,
    isHidden: false,
    environment: null,
    host: null,
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - DAY,
    lastReadAt: null,
    latestAttentionAt: null,
    indicator: "idle",
    indicatorLabel: "Idle",
    ...overrides,
  } as PluginSidebarThread;
}

export function project(id: string, name: string): PluginSidebarProject {
  return { id, name, isPersonal: false, href: `/projects/${id}`, settingsHref: `/projects/${id}/settings` };
}

export function sidebarState(
  overrides: Partial<PluginSidebarThreadsState> & {
    archived?: Partial<NonNullable<PluginSidebarThreadsState["experimental_archived"]>>;
  } = {},
): Partial<PluginSidebarThreadsState> {
  const { archived, ...rest } = overrides;
  return {
    status: "ready",
    threads: [],
    projects: [],
    sections: [],
    experimental_archived: {
      status: "ready",
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: async () => {},
      ...archived,
    },
    ...rest,
  };
}

export { DAY };
