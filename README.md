# Archive (bb plugin)

A searchable **Archive** page for [bb](https://getbb.app). It adds an Archive
destination to the sidebar navigation. The page lists every archived thread,
grouped by project (newest archived first), with a search box that filters by
thread title, project name and message text as you type.

Each row opens the thread on click. On hover it shows bb's own **Unarchive**
button and bb's **⋯** thread menu, the same actions as the sidebar. Archived
threads stay out of the normal sidebar.

## Install

```sh
bb plugin install git:github.com/vicegold/bb-plugin-archive-page@^0.1.0 --yes
```

bb builds the plugin on install and offers new releases through
`bb plugin outdated` / `bb plugin update archive-page`.

## Develop

```sh
npm install --include=dev
bb plugin install .          # register this checkout in place
bb plugin dev                # rebuild and reload on every save
```

- `npm test`: Vitest (logic in `lib/archive.ts`, panel via `@get-bb/plugin-sdk/testing/app`)
- `npm run typecheck`
- `npm run build`: `bb plugin build`

Release: bump `version` in `package.json`, commit, `git tag vX.Y.Z && git push --tags`.

## License

MIT
