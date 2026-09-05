## Context

See proposal.md - Why for the root-cause analysis. `isOpenSpecInstalled()` in `src/cli/init.ts` currently classifies "not installed" as `(err as NodeJS.ErrnoException).code === "ENOENT"` on the `execa("openspec", ["--version"])` rejection, re-throwing anything else. This repo pins `execa@^9.0.0` (currently resolving to `execa@9.6.1`), which depends on `cross-spawn@^7.0.6`. On Windows, `cross-spawn` relays a missing-executable spawn through `cmd.exe` and synthesizes an `ENOENT`-shaped error only when the wrapped process exits with status `1` and its own file-resolution step (`which`) also failed (`lib/enoent.js`'s `verifyENOENT`). That emulation has a documented history of edge cases where it does not fire (cross-spawn #16, #104; execa #446/PR #447), which was the leading hypothesis for this ticket's report.

**Confirmed by repro**: with `openspec` absent from `PATH` on Windows, `execa("openspec", ["--version"])` rejects with an `ExecaError` carrying `exitCode: 1` and stderr `'openspec' is not recognized as an internal or external command, operable program or batch file.`, but no `code` property — the emulation genuinely does not fire in this case. `isOpenSpecInstalled()`'s `err.code === "ENOENT"` check is therefore `false`, and `lv init` crashes with the raw `ExecaError` instead of offering to install OpenSpec.

There is no reliable, purely error-shape-based signal to distinguish "openspec not installed" from "openspec check failed for some other reason" on Windows. The fix needs to work whether or not the emulated `ENOENT` fires.

## Goals / Non-Goals

**Goals:**
- Detect "openspec not installed" correctly on both POSIX and Windows without depending on a single error-shape signal that has known platform-specific gaps.
- When the *subsequent* `openspec init` invocation fails (detection succeeded, but the real install/init step didn't), fail loudly with the underlying diagnostic (stderr) instead of a bare, contextless message.

**Non-Goals:**
- Root-causing every possible Windows spawn-error shape beyond the one now confirmed — the fix is designed to be correct regardless of exact error shape, not just the confirmed one.
- Changing how `openspec init` itself behaves, or anything about the `openspec/config.yaml` patching logic.
- Adding a Windows CI job or other test-infrastructure change; verification here is manual/code-review only (see tasks.md).

## Decisions

**Detection strategy: check the resolved command path directly, not the shape of the spawn error.**

Instead of trying to interpret whatever error `execa("openspec", ["--version"])` throws, resolve whether `openspec` exists on `PATH` up front using Node's own `child_process` PATH-resolution primitives that don't route through a shell: on POSIX, check with `execa("command", ["-v", "openspec"], { shell: ... })`-style lookups are themselves shell-dependent and inherit the same cmd.exe-relay problem on Windows. Preferred approach: use the `which` package — the same one `cross-spawn` depends on and uses internally for this exact resolution step — directly: `which.sync("openspec", { nothrow: true })` returns the resolved path or `null` without going through `cmd.exe`'s exit-code relay. `which` is currently only a transitive dependency (pulled in via `cross-spawn`), so this change adds it as a direct dependency in `package.json` rather than relying on npm's hoisting to make it resolvable from `src/cli/init.ts`. This makes "installed" a direct filesystem/PATH question instead of an inference from a spawned process's failure mode, so it works the same way regardless of platform or of cross-spawn's internal ENOENT emulation.

**Accepted trade-off: `which.sync(..., { nothrow: true })` can never distinguish "not found" from "found the check but something else failed."** Reading `node_modules/which/which.js`'s `whichSync`, every per-candidate check (`isexe.sync`) is wrapped in a bare `try {} catch (ex) {}` and just moves on to the next `PATH` entry — with `nothrow: true` it never throws, period, regardless of *why* nothing resolved (missing, unreadable, permission-denied directory, etc.). This is true of `which`'s async form too (its callback ignores the `isexe` error the same way), so no variant of this package preserves that distinction — it isn't a choice this change is declining, it's not available from the tool at all. `isOpenSpecInstalled()` therefore becomes a plain synchronous boolean with no error path, and any of those underlying causes is folded into "treat as not installed" — the install prompt is worded "not found or not installed properly" to reflect that ambiguity rather than asserting a specific cause. This is an acceptable trade because the two folded outcomes lead to the same next step (offer the install prompt) and any real underlying problem (e.g. a broken/unreadable global install) will still surface loudly at the next command that actually needs to run `openspec` (the `openspec init` invocation, or the reinstall/`--version` check itself) — it is not silently swallowed forever, just not diagnosed at this exact step.

Rejected alternative: broaden the error-shape check (e.g. also treat Windows exit code `1` or a stderr match against `/is not recognized/i` as "not installed"). Rejected because it keeps the detection coupled to `cmd.exe`'s message text and cross-spawn's relay behavior — exactly the fragile mechanism causing the bug — and would need separate handling per platform indefinitely.

**Diagnostics: surface `err.stderr` in `runInit()`'s `openspec init` failure path.**

`isOpenSpecInstalled()` no longer throws (see above), so this applies only to the one remaining unclassified spawn failure: the `openspec init` invocation itself. execa attaches captured `stderr` to its rejection error. Today `printError(...err.message...)` only shows `err.message`, which for a command-failure error is often just "Command failed with exit code N" — no indication of *why*. Appending `err.stderr` when present costs nothing and makes a platform-specific `openspec init` failure self-diagnosing from the printed output alone.

## Risks / Trade-offs

- [`which.sync` behaves subtly differently from `cross-spawn`'s own two-pass resolution (with/without `PATHEXT`) in some edge case] → `which` is the same package `cross-spawn` itself depends on and uses for this exact purpose (`node_modules/cross-spawn/lib/util/resolveCommand.js`), so behavior stays consistent with what `execa`/`cross-spawn` would actually attempt to spawn.
- [`which.sync(..., { nothrow: true })` folds every check failure — not just "genuinely absent" — into "not installed," so a present-but-broken OpenSpec install (e.g. unreadable due to permissions) triggers an unnecessary install-offer instead of a distinct error] → this is a property of the `which` package itself (see Decisions), not a choice available to avoid; the prompt's wording ("not found or not installed properly") reflects the ambiguity, and any real underlying problem still surfaces loudly at the next command that touches `openspec` rather than being silently lost.
- [This environment has no Windows machine, so the fix itself — as opposed to the now-confirmed bug — can't be empirically verified here] → the failure this fix targets is now confirmed via a captured repro (see Context); the fix's correctness is verifiable by code review and by unit-testing `isOpenSpecInstalled()`'s logic with a mocked/absent `which` result, and should be spot-checked on Windows before closing the ticket (see tasks.md).
