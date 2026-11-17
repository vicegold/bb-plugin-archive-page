// bb-plugin-archive-page — backend entry.
//
// The Archive page is frontend-only (app.tsx); bb's manifest still requires a
// server entry, so this factory registers nothing.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");
}
