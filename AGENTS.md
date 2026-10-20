# Repository Working Agreement

## Commit and push cadence

The user authorizes routine commits and pushes of completed work to the current branch's configured upstream. After a meaningful, coherent batch of changes is complete and appropriate checks pass, commit and push without asking again. Examples include a finished feature or fix, a pipeline migration, or a completed asset pack. Avoid a commit for every tiny intermediate edit; keep commits reviewable and describe the final behavior.

Before committing, review the diff and staged files, keep credentials and local/build artifacts out of Git, and preserve unrelated work. Run checks appropriate to the changes. Never force-push, rewrite published history, or discard work to satisfy this cadence. If checks fail or pushing is blocked, report that clearly rather than claiming completion.
