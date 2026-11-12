# Platform refresh: agent handoff

Milestone: **Platform refresh** (#5). Tracking issue: #227. Read `agents.md` and `CONTRIBUTING.md` first.
This sheet is for one agent working the lanes in order, or several agents working lanes in parallel.

## Goal

Move the UI to `gpui-kit`, replace hand-written code with maintained crates, and fix audio-thread hygiene. Audio crates do not change shape; the UI and a few dependency swaps do.

## Hard rules (from the repo)

- `unsafe_code = "forbid"` everywhere except `om-stretch` (FFI) and the `abi` and `loader` modules in `om-plugins`. Do not add `unsafe` or `#[allow(...)]` without a written reason next to it.
- Do **not** set `panic = "abort"`. Deck workers, the job queue and the watch-folder scanner rely on `catch_unwind`.
- The audio callback must not allocate, lock or block. Prove it with `assert_no_alloc` (already a dependency).
- Each issue is its own branch and PR. Branch from `main`. Use a separate git worktree per agent (`.claude/worktrees/<name>`). Never share a working tree between agents.
- Before every PR: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo deny check`. Put the results in the PR's Testing section.
- Do not add a dependency without a call site that deletes code, unless the issue says otherwise. Update `deny.toml` if licences change.
- Do not commit the untracked `docs/design-system/` or `docs/superpowers/plans/2026-11-05-ui-faceplate-redesign.md`; they belong to someone else.
- End commits and PR bodies with the attribution lines the session specifies.

## Issue map and dependencies

| Issue | Step | Depends on | Lane |
|---|---|---|---|
| #218 | P0 Spike: gpui-kit builds with cpal and midir | none | UI |
| #219 | P1 Migrate workspace to gpui-kit | #218 | UI |
| #220 | P2 midir backend | #219 | Controllers |
| #221 | P3 rubato | none | Engine |
| #222 | P4 ebur128 metering | none (UI meter needs #219) | Engine |
| #223 | P5 gpui-component chrome | #219 | UI |
| #224 | P6 utility crates | none | Engine |
| #225 | P7 CLAP via clack | design note, then #219 | Plugins |
| #226 | P8 DSP bounds-check hygiene | none | Engine |
| #228 | P9 thread priority | none | Engine |
| #229 | P10 desktop integration | #219 | UI |

Order: #218 gates #219; #219 gates #220, #223, #229 and the UI parts of #222 and #225. #221, #224, #226 and #228 can start now.

## Suggested agent split

**Agent A, UI lane (serial):** #218, then #219, then #223, then #229. This is the critical path. Do not split #219 across agents; it touches most of `om-ui-gpui`.

**Agent B, Engine lane:** #228 (small, start here), #221, #226, then the non-UI part of #222. Work in `om-engine`, `om-dsp`, `om-analysis`, `om-stems`. Rebase on `main` when Agent A merges anything that touches shared files.

**Agent C, Controllers and utilities:** #224, then #220 once #219 has merged. Hold #220 until then.

**Agent D, Plugins (later):** #225 design note only until the design is signed off by the user.

A single agent should follow the order: #218, #219, #228, #221, #226, #222, #220, #223, #224, #229, #225.

## Per-issue brief

**#218 P0 spike.** In `spikes/gpui-window`, depend on `gpui-kit` 0.8.x (check the latest 0.8/0.9 on crates.io) with cpal 0.18 and midir 0.11. Render one `gpui-component` page and one custom-painted knob. Check `cargo tree -d` for duplicate GPUI or core-foundation copies. Write the result into `docs/spikes/DECISIONS.md`. If it cannot resolve, stop and report to the user; do not force it.

**#219 P1 migration.** The kit uses the `gpui-pre` snapshot (0.3.x). Replace `gpui = "=0.2.2"` in `crates/om-ui-gpui/Cargo.toml`. Port `*_paint.rs`, `deck_view.rs`, `app.rs`, `drag.rs`, `controls.rs`. Expect API changes around `canvas`, `Element`, paint and layout, and text. Keep pages visually identical; use `tools/screenshots.sh` and `docs/screenshots/` to compare. Update `deny.toml` if the new GPUI tree needs it.

**#220 P2 midir.** Replace `crates/om-midi/src/alsa_backend.rs`. A first attempt failed only on dependency resolution (midir 0.11 needs `core-foundation` 0.10.1, `gpui =0.2.2` pins `=0.10.0`; midir 0.10 clashes with cpal's `alsa`), not on code. Notes for the implementation:
- Keep the `MidiBackend` trait unchanged.
- midir ALSA port names carry a trailing `client:port` address; strip it for the port id so saved preferences survive replug.
- Skip the "Midi Through" and `openmixer` ports.
- Replace `tests/alsa_backend.rs` with a midir smoke test that skips without `/dev/snd/seq`.
- Update `docs/spikes/DECISIONS.md` and the doc comment in `backend.rs`; drop the direct `alsa` dependency.

**#221 P3 rubato.** Replace `crates/om-stems/src/resample.rs` and `resample` in `crates/om-engine/src/sampler/sample.rs` with rubato 5.0.1 (`Async`, `process_into_buffer`, no allocation after construction). Separately evaluate it for the deck's varispeed in `crates/om-engine/src/deck/playback.rs` (the phase `ratio` step around line 303); only switch if it is better and fits the callback budget. Check `output_delay()`. Confirm in rubato's source whether `set_resample_ratio` allocates before calling it on the audio thread. Rubato does not do key lock; `om-stretch` stays.

**#222 P4 ebur128.** Use the `ebur128` crate (0.1.11), not `ebur128-stream`. The audio callback copies blocks into an `rtrb` ring; a worker thread calls `add_frames` and publishes momentary, short-term, integrated, LRA and true-peak via atomics. Verify against EBU Tech 3341/3342 reference files (obtain them from the EBU). Prove zero allocation on the audio side.

**#224 P6 utilities.** See the issue for the exact list. Promote already-transitive crates only where a call site replaces code. Do not re-add `assert_no_alloc`, `proptest`, `rtrb`.

**#226 P8 bounds checks.** Profile first. Use `cargo-show-asm` to find `panic_bounds_check` in `om-dsp`, `om-engine`, `om-analysis` hot loops, and `divan` benchmarks to confirm cost. Replace indexing with iterators, `zip`, `chunks_exact`; hoist `assert!(len >= n)` before loops that must index. No `get_unchecked`. Report before and after numbers. Revert any change that regresses.

**#228 P9 thread priority.** Add `audio_thread_priority`. Promote the audio callback thread and deck decoder workers. Fail soft: log and continue if refused.

**#223 P5 chrome.** Replace widgets in `controls.rs`, `library_view.rs`, `debug_panel.rs` and `app.rs` with `gpui-component`. Evaluate gpui-base `Dock`, `UndoHistory`, `Motion`, `VirtualList`. Knobs, faders, meters, waveform and platter stay custom.

**#229 P10 desktop integration.** `rfd`, `arboard`, `souvlaki`, `tray-icon`, `notify-rust`. Each only where it adds a working feature. Check main-thread requirements against GPUI's event loop first.

**#225 P7 clack.** Design note first, no code. Open questions: host third-party CLAP plugins or only your own; Wayland uses floating windows (no reparenting); X11/Win32/Cocoa embed via `HasWindowHandle` (gpui-pre implements it for `Window`); clack 0.2.0 is pre-1.0; the docs disagree on whether `PluginEntry::load` needs `unsafe`. Get the user's sign-off on the design before building.

## Known unknowns (verify, do not assume)

- Whether `gpui-kit`'s `gpui-pre` snapshot lets midir 0.11 resolve. It should (it uses `objc2-core-foundation`, not the pinned `core-foundation`), but it has not been built.
- Whether GPUI exposes what `souvlaki` and `tray-icon` need (main-thread hook, window handle).
- Whether `rubato`'s `set_resample_ratio` is allocation-free.
- `ebur128` allocation behaviour is undocumented; test with `assert_no_alloc`.
- clack GUI embedding against GPUI's scene is untested.

## Coordination

- Comment on the issue when starting and when blocked. Tick the box in #227 when an issue's PR merges.
- If two agents need the same file, the UI lane owns `crates/om-ui-gpui/**`; the engine lane owns `om-engine`, `om-dsp`, `om-analysis`, `om-stems`; the controllers lane owns `om-midi`.
- Stop and ask the user before: changing a public trait in `om-core`, adding `unsafe`, changing `deny.toml` policy, or abandoning a step.
