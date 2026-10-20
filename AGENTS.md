# Repository Working Agreement

## Development and platform builds

Use the Vite dev server for routine development and testing. Build Windows/Tauri or any other native platform only when the user explicitly requests that platform build. Do not automatically build native apps or installers after features, fixes, asset changes, or commits. Native builds will be requested occasionally as needed; routine web checks do not require them.

## Commit and push cadence

The user authorizes routine commits and pushes of completed work to the current branch's configured upstream. After a meaningful, coherent batch of changes is complete and appropriate checks pass, commit and push without asking again. Examples include a finished feature or fix, a pipeline migration, or a completed asset pack. Avoid a commit for every tiny intermediate edit; keep commits reviewable and describe the final behavior.

Before committing, review the diff and staged files, keep credentials and local/build artifacts out of Git, and preserve unrelated work. Run checks appropriate to the changes. Never force-push, rewrite published history, or discard work to satisfy this cadence. If checks fail or pushing is blocked, report that clearly rather than claiming completion.
