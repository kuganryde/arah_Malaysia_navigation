# Versioning

ARAH is versioned **per module**. A module is a group of files that change together; each has its own [SemVer](https://semver.org/) number in `versions.json`, so a fix to the voice endpoint does not pretend the map changed.

| Module | Owns | Version marker in the file |
| --- | --- | --- |
| `app` | `index.html`, `source/**` | none (the number lives in `versions.json`) |
| `api-tts` | `api/tts.js`, `lib/**` | `// api-tts vX.Y.Z` |
| `enhancements` | `assets/arah-enhancements.js` | header comment and `window.__arahEnh` |
| `security-headers` | `vercel.json`, `SECURITY.md` | none |
| `privacy` | `privacy.html` | `<meta name="module-version">` |
| `ci` | `.github/**`, `scripts/**`, `test/**` | none |
| `docs` | `README.md`, README art, `VERSIONING.md` | none |

The **release** number in `versions.json` (mirrored in `package.json`) groups the module versions that ship together. `GET /versions.json` on the deployed site shows exactly what is running.

## Rules

- **patch** (`x.y.Z`): fix or tweak with no change in behaviour users or callers can rely on.
- **minor** (`x.Y.0`): new capability, backwards compatible (a new report type, a new env var with a default).
- **major** (`X.0.0`): breaking change (a changed API shape, a removed setting, a dropped language).
- While a module is below 1.0.0, a minor bump may include small breaking changes; say so in the changelog.
- Changing a module's files without bumping its version fails CI. Bumping a version without changing its files also fails.
- Every bump adds a line to `CHANGELOG.md` under `[Unreleased]`: `- **module x.y.z**: what changed`.

## Commands

```bash
npm run version:status                                   # every module and its version
npm run version:bump -- api-tts patch "reject empty lang" # bump a module, update its in-file marker, log it
npm run version:release -- minor                          # cut a release: bump release, package.json, close [Unreleased]
npm run version:check -- origin/main                      # what CI runs on a pull request
```

After changing any file the service worker caches, run `npm run pwa:stamp` (it rewrites `sw-precache.js`, which is what makes installed copies update). `npm run check` fails if it is stale.

`bump` rewrites the module's in-file marker and `versions.json` together, so the running file and the manifest cannot drift; `npm run version:check` fails if they do.

## Adding a module

Add an entry to `versions.json` with `version`, `description`, `paths` (globs: `**` crosses folders, `*` does not) and optional `markers` (`{ "file", "text" }` where `{v}` is replaced by the version). Start at `0.1.0` and document it in the table above.

After regenerating `index.html` from the design source, re-run in this order: `npm run pwa:inject`, `npm run perf:fonts`, `npm run pwa:stamp`.
