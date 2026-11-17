// bb-plugin-archive-page — frontend entry.
//
// One rail destination: a searchable list of archived threads, grouped by
// project, with bb's own Unarchive action and thread menu on every row.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { ArchivePanel } from "@/components/archive-panel";

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "archive",
    title: "Archive",
    icon: "Archive",
    path: "archive",
    component: ArchivePanel,
  });
});
