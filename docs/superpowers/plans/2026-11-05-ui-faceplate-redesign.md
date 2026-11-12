# UI redesign: the Machined Faceplate

Status: proposed, not started. Nothing here is decided until Phase 0 is signed off.

Date 2026-11-05. Inputs:

- `docs/design-system/DESIGN.md` (the system: tokens, rules, components), `docs/design-system/PRODUCT.md` (scope), `docs/design-system/.impeccable/design.json` (token sidecar).
- `docs/design-system/Design System.dc.html` (app canvas: Foundations, Two densities, Light mode, States). Open it in a browser; section 4a/4b are the target layouts.
- `docs/design-system/Website Design System.dc.html` and the website repo (`openmixer-web`) already ship this look; the app is the last surface still on the old one.
- `docs/PRODUCT.md` (the bar), `docs/design/review-gates.md` (how UI decisions are made), `docs/design/E1-brand.md` (the look being replaced), ADR 0001 (clean room), ADR 0005.
- Current state: `docs/screenshots/main-dark.png`, `resources/themes/*.json`, `crates/om-ui/src/theme/`, `crates/om-ui-gpui/src/`.

**Goal.** Rebuild the interface so the running app matches the design system: a warm matte faceplate with near-square parts, etched 1px lines instead of glass and glow, four muted deck hues each paired with a letter, one signal red, and every number in monospace. The three built-in themes (dark, daylight, harbour) and both densities (Roomy, Compact) ship.

**Not a goal.** No engine, audio, analysis or persistence change. No new features beyond the ones the comp already shows and the app already has (see Phase 0 for the few that are not in the app yet). No new crate dependencies.

## 0. What changes, in one table

| Area | Today (E1, `main-dark.png`) | Target (`DESIGN.md`) |
|---|---|---|
| Ground and surfaces | Blue-black `#0B0D12` gradient backdrop, two soft glows, translucent "glass" cards | Matte warm neutrals `#121211` ground, `#181816` panel, `#22211e` control, `#0a0a09` well. No gradient, no glow tokens |
| Depth | Glow on active states, gradient caps (`capTop`/`capBottom`), shadows | 1px inset etched line (`#302e2a`) plus 1px top highlight (white 4%). One small drop (`0 2px 3px` / `0 3px 5px`, 50% black) on raised controls only |
| Corners | card 14, control 8 | 3 on large panels, 2 on controls, circles for knobs |
| Spacing | 16 / 16 / 8 | Fibonacci 3, 5, 8, 13, 21, 34. Compact is Roomy shifted one step down |
| Deck identity | Accents cyan, pink, violet, lime | Amber `#e3a24f` (A), Slate `#86a9cb` (B), Sage `#9cb585` (C), Clay `#c9705c` (D). A deck hue never appears without its letter |
| Playhead, record, "now" | Ember `#FF6B35` brand colour marks the playhead, wordmark, master | Signal Red `#ef5a3f`, playhead and record only. Ember is retired |
| Active control | Glows in the deck colour | Deck-hue tint 22% over the control plus a 70% hue border. Playing transport is a solid deck fill |
| Meters | Green, yellow, red ramp | Grey ramp, red above -3 dB, the word CLIP in red held until reset |
| Waveform colour | Spectral hue by centroid (cool to warm) | Low band takes the deck colour, highs sit in neutral on top (the Low-Band Rule). See Decision D4 |
| Type | Inter 12/14/16/20/40, Regular | Sansation (wordmark and headings, 21px and up), Source Sans 3 (all UI text, 13px body, 11px label), Ubuntu Mono (every number: 13px, 21px for primary readouts) |
| Focus | Ring in `focusRing` | 2px ivory ring, 2px offset, never removed |
| Disabled and error | Dimmed | Panel tone, dashed 1px edge, tertiary text. Errors state the reason in words; red is not used for errors |
| Layout | Channel strips at the window edges, mixer 214px between decks | Header with deck headers and master tempo, two stacked waveforms (A amber, B slate), then deck A controls, mixer (EQ for both channels, faders, crossfader), deck B controls mirrored, library below. See Phase 5 |

## 1. Decisions needed before code (Phase 0)

These are the user's call (`review-gates.md`: unsourced items and the final look are decided by the owner). Each gets a recommendation; none is silently assumed.

- **D1. Replace E1 formally.** `DESIGN.md` says it supersedes E1's ember, "active means glow", cool deck hues, violet-cast ground and motion tokens. Write ADR 0007 recording that, mark `E1-brand.md` superseded, and update `docs/PRODUCT.md` item 4 ("glow and contrast on active states"), which currently contradicts the new rule. Recommendation: yes.
- **D2. Fonts.** Replace the bundled Inter with Sansation, Source Sans 3 and Ubuntu Mono. Check each licence is compatible with AGPLv3 distribution and with `NOTICE` (Source Sans 3 is OFL; Sansation and Ubuntu Mono need their licence texts read, the Ubuntu Font Licence in particular), bundle the licence files next to the fonts like `Inter-OFL.txt`, and note the binary-size change. Open question: can GPUI 0.2.2 select weights (Sansation 700, Source Sans 500/600, Ubuntu Mono 500) from bundled static files? Settle in the P2 spike below; if it cannot, the fallback is one file per weight registered under its own family name.
- **D3. Four decks.** The system defines decks A to D; the app and demo scene show two. Confirm the main window stays two decks in this pass and that C and D appear only in the theme, the tag chips and the stems and sampler surfaces that already address more than two.
- **D4. Waveform colour.** The app's `docs/PRODUCT.md` says "colour carries the spectrum", and `waveform/palette.rs` implements a spectral hue curve with tests (`wave_palette`, `wave_flicker`, `wave_budget`). The design system replaces it with deck-coloured lows over neutral highs. Recommendation: build the Low-Band style as the default, keep the spectral curve as a second selectable style (the `OPENMIXER_WAVE_STYLE` switch exists), and judge both on real music before deleting anything.
- **D5. Harbour Night.** The system gives dark and daylight values but no Harbour Night palette and there is no screenshot of it. Either design it first (a cool-cast variant of the same roles) or ship it unchanged in structure with a placeholder derived from dark, marked unsourced. Recommendation: derive and mark unsourced, then review.
- **D6. Theme names.** "Midnight Glass" and "Daylight Frost" name glass and frost, which the system retires. Keep the ids (`openmixer.dark`, `openmixer.daylight`, `openmixer.harbour`) so saved preferences keep working. Decide whether the display names change.
- **D7. Controls in the comp that the app may not have.** The Full / Controller toggle in the header, the "Compatible with A" library filter, the "vs A" key column and the master tempo readout. Check each against the app today (`mix_match.rs` already computes key compatibility; the header currently has a library toggle that was PERFORM). List what exists, what is a relabel, and what is new; anything new is its own item, not part of this rebuild.
- **D8. Density selection.** Today width alone switches the library sidebar (`COMPACT_WINDOW_WIDTH` 1400). Roomy and Compact are whole-window metric sets. Recommendation: a preference (Appearance page) with an automatic default from window height, since `MIN_WINDOW` is 1280x720 and Roomy may not fit there.

Phase 0 output: ADR 0007, the answers above recorded in `docs/design/`, and an updated plan.

## 2. Constraints carried over

- Clean room (ADR 0001): conventions only. The comp is OpenMixer's own, so it is a safe reference; do not look at other programs for layout.
- The UI never touches the audio thread. Painting reads published state as it does now.
- No colour literals in view code: `crates/om-ui-gpui/tests/style_lint.rs` fails the build on them. New colours become theme tokens.
- No new crate dependencies. Do not stage `Cargo.lock` changes.
- Shared files (`deck_view.rs`, `mixer_view.rs`, `drag.rs`, layout rects) are edited one branch at a time. The phases below are ordered so only one is touching each file.
- Every phase that changes what a DJ sees ships a screenshot taken from that branch (`tools/screenshots.sh`) and looked at by eye, plus real music for waveform and library work (`docs/PRODUCT.md`).
- Smoothness is measured, not judged: frame times with real music, four decks and stems, using the existing `frame_stats.rs` and the wave tests.
- Unsourced values are marked as such in the PR description, kept small, and reversible.

## 3. Phases

Each phase is one branch and one PR, merged before the next starts unless stated.

### Phase 1: theme tokens and schema

Owns `crates/om-ui/src/theme/{tokens,json}.rs`, `resources/themes/*.json`, `crates/om-ui/tests/{theme_json,theme_registry}.rs`.

1. Map the system onto `ThemeTokens`. Reuse where the role is the same: `surface` (panel), `surface_raised` (control), `surface_hover`, `well`, `border` (etched line), `border_strong` (graphic edge `#75716a`), `text_*`, `focus_ring`, `accents` (A to D). Add what is missing: a `playhead` / signal-red token (`record_red` can alias it), `edge` etched-line and top-highlight strengths, and a `deck_tint_alpha` / `deck_border_alpha` pair for the "on" state (22% and 70%, 32% and 85% on hover).
2. Remove or neutralise glass and glow: `backdrop_top/bottom`, `glow_cool`, `glow_warm`, `cap_top/bottom` gradients, `brand` as ember. The JSON loader must keep accepting the old keys with a warning (it already tolerates a retired key) so user theme files do not break.
3. Spacing and shape: Fibonacci steps, radii 3 and 2, control heights 26 and 21, knob 34 and 26, pad 55 and 34, row 34 and 26, mixer width 320 and 260. Express density as a metrics set the theme selects, not as scattered constants.
4. Rewrite the three theme files from `DESIGN.md` (dark and daylight values are given there; harbour per D5).
5. Tests: range checks for new keys; contrast tests promoted from the brand record: numerals 7:1, lit controls 3:1, `text-3` at least 4.95:1 on every dark surface, graphic edge 3:1 on panel and control; deck hues A and B stay distinct under colour-blind simulation (and C and D separate under red-green, the reason Clay was deepened). Keep the existing daylight contrast test.

Gate: `cargo test -p om-ui`, theme JSON round trip, `cargo clippy`. No visual change yet beyond colours; screenshot dark and daylight to confirm nothing is unreadable.

### Phase 2: fonts and type

Owns `crates/om-ui-gpui/src/font.rs`, `resources/fonts/`, `NOTICE`, the type tokens.

1. Spike first (half a day, one throwaway branch): in GPUI 0.2.2, bundle one static file per weight and confirm weight selection, `tnum` for Source Sans if used, and letter-spacing (Sansation display uses -0.01em, label caps use spacing). Record the result in `docs/spikes/`.
2. Register Sansation 700, Source Sans 3 (400, 500), Ubuntu Mono (500). Theme keys `font.display`, `font.body`, `font.mono`.
3. Type scale per `DESIGN.md`: display 34, headline 21, body 13, label 11, numeral 13, numeral-large 21.
4. A single numeric text helper in `om-ui-gpui` that always uses the mono family. Audit every place a number is drawn (BPM, key, time, dB, library columns, counters, sampler gain) and route it through the helper. Add a grep-style test like `style_lint` that flags number-formatting call sites drawing with the body font where practical.
5. Rules as tests: Sansation never below 21px, no label below 11px, no prose below 12px. The only 10px text is the fader dB scale, allowlisted.

Gate: the bundled font tests (as in `font.rs` today) updated; screenshot of the header, a deck and the library at 1280x800.

### Phase 3: control primitives

Owns `controls.rs`, `knob_paint.rs`, `fader_paint.rs`, `meter_paint.rs`, `platter_paint.rs`, `record_button.rs`, `paint.rs`, and `om-ui/src/{widgets,meter,style}.rs`. Do this before layout, so the layout work lays out the final parts.

1. Spike: confirm how GPUI paints an inset 1px line, a 1px top highlight and the small drop (quads with borders and shadow). If inset shadows are not available, draw the line as a border quad and the highlight as a second 1px quad. Record the result.
2. Button, pad, segmented control, deck-tag chip (letter in mono 700 on the deck hue), toggle, with the full state set from the canvas "States" section: default, hover (one tonal step), pressed (sinks to the well tone), keyboard focus (2px ivory ring, 2px offset), on, playing (solid deck fill, ground-coloured text), disabled (dashed edge), loop active and sync locked (the "on" state plus a mono word such as LOCK so the state reads without colour), clip.
3. Knob: 34 and 26 circles with a 2px arc from centre for bipolar EQ, centre detent, value in mono beside it. Fader: dB-scaled ticks (10px mono), hardware-style cap in a flat two-tone, deck colour marking the active deck. Meters: 4px wide segments, grey ramp, red above -3 dB, hold tick, CLIP word.
4. Remove glow, gradient caps and blur code; the style lint and the dark-room smoothness budget both benefit.
5. Replace `examples/knob_gallery.rs` with a controls gallery that renders every control in every state in all three themes and both densities. It is the review surface for this phase and for the later ones.

Gate: gallery screenshots in 3 themes x 2 densities; tests for hit-testing and minimum targets stay green (`mixer_widgets`, `deck_widgets`).

### Phase 4: waveform and overview

Owns `waveform_paint.rs`, `om-ui/src/waveform/*`, the deck overview strip. Needs D4 decided.

1. Low-Band style: low frequencies in the deck colour, highs in neutral on top, in the 4a/4b comps' proportions. Keep the spectral style behind the existing switch until D4 is closed.
2. Playhead 2px signal red, fixed at centre. Cue flags: deck-colour flag with the cue number and a 1px guide at 45%. Loop: deck colour at 14% fill with 1px edges, length in the label. Beat grid: bars 14%, beats 5% of text colour; bar numbers bottom-left in mono. Ink Well ground.
3. Overview strip in the deck header (the thin full-track strip with the viewport window), in the deck colour, as in the comp.
4. Performance: `wave_budget` and `wave_flicker` must still pass; measure frame time at the display's refresh rate with real tracks and stems.

Gate: screenshot with real music (`OPENMIXER_DEMO_TRACK`), two decks, a loop, five cues. Compare to canvas 4a and 4b by eye.

### Phase 5: layout and composition

Owns `om-ui/src/{main_layout,header_layout}.rs`, `om-ui-gpui/src/{app,deck_view,mixer_view,header_view,stage_view,library_view,library,sampler_view,automix_bar}.rs`, `om-ui/tests/main_layout.rs`. This is the structural change, so it is last among the build phases and runs on its own.

1. Update the rect contract in `main_layout.rs` first, with its tests, before drawing: header (wordmark, latency and dropouts, mode toggle, Rec, Settings), deck header row (tag chip, title, artist, BPM, key, remaining, overview) with the master tempo centred, stage (A and B waveforms stacked, full width), controls row (deck A | mixer | deck B mirrored, mixer 320 Roomy and 260 Compact), library band. Today's channel strips at the window edges move into the mixer column per the comp; this changes the rect contract, so the tests (no overlap, everything inside the window, library below the decks, minimum window 1280x720, plus 900x600, 1024x640, 1920x1080) are rewritten with it and must stay green.
2. Deck B mirrors deck A so each deck reads from its outside edge.
3. Deck controls: transport under the waveform, the Hot cues / Loop / Stems / FX segmented tabs, pads 55 and 34, sync and key lock. Mixer: EQ for both channels on either side of the faders, filter, channel faders with meters, crossfader with A and B tags and the curve selector.
4. Library: 34 and 26 rows, BPM and key in mono, Delta BPM and "vs A" key cue against the playing track, selected row slate tint 18% with 55% edge, loaded-on-deck letter with 40% deck edge, error rows dimmed with a dashed edge and the reason in words.
5. Secondary surfaces take the tokens without redesign: sampler drawer, automix bar, record bar, stems page, settings overlay, debug panel. Rebuild only what the new tokens break.
6. Density: implement D8; both metric sets go through the same layout code.

Gate: `main_layout` tests at every listed size, full screenshot set (below), keyboard walk of the whole window.

### Phase 6: themes, polish and verification

1. Screenshot matrix with `tools/screenshots.sh` on the branch: every scene x dark, daylight, harbour x Roomy, Compact x 1280x720, 1440x900, 1920x1080 where the script supports it. Look at every image against the matching canvas section. Record defects the way `docs/screenshots/REVIEW.md` does (found, fixed, not fixed and why).
2. Real-music pass: a long analysed track, two decks, loops, cues, stems, automix running. Frame-time budget per `docs/PRODUCT.md` open questions; record the numbers.
3. Accessibility: keyboard focus visible everywhere, no meaning by colour alone (deck letters, LOCK, CLIP), contrast tests from Phase 1 still green, all animation respects a reduced-motion preference if the app has one (add if not).
4. Refresh `docs/screenshots/` on purpose (`OUT_DIR=docs/screenshots`), update `docs/PROGRESS.md`, `ROADMAP.md`, `agents.md` (theme and font notes), the README screenshot, and mark `E1-brand.md` superseded.
5. After the build, regenerate `docs/design-system/DESIGN.md` from the shipped code (`/impeccable document`) so the record matches the artifact, and run `/impeccable critique` on the captures for the final score.

## 4. Order and dependencies

```
Phase 0 (decisions, ADR)
  -> Phase 1 (tokens)  -> Phase 2 (fonts)  -> Phase 3 (controls)
                                              -> Phase 4 (waveform)   [needs D4]
                                              -> Phase 5 (layout)     [after 3 and 4]
  -> Phase 6 (themes, verification)
```

Phases 2 and 3 can overlap only if they touch separate files; Phase 4 and Phase 3 can run in parallel for the same reason. Phase 5 never overlaps another phase.

## 5. Risks

- **GPUI limits.** Inset lines, 1px highlights, font weights and letter-spacing are assumed possible; the two spikes (P2, P3) confirm them before the rest is built. A failed spike changes the approach, not the design.
- **Waveform cost.** A new colour style must hold the frame budget; the wave tests and a real-music measurement gate Phase 4.
- **Layout churn.** Moving channel strips into the mixer rewrites the rect contract and its tests. Keeping Phase 5 isolated limits the blast radius.
- **Comp gaps.** The canvas shows dark and daylight only, two decks, and no Harbour Night. Anything the comp does not show is marked unsourced and decided by the owner, not invented.
- **Scope creep.** D7 items that are new features are tracked separately and do not block this rebuild.

## 6. Done means

- All three themes and both densities render the comp's look in the running window, checked by screenshots from the final branch.
- Contrast, minimum-size and no-overlap tests pass; `style_lint` has no allowlist growth beyond `paint.rs`.
- No glow, blur, gradient caps or ember colour remain in the UI crates.
- Frame times with real music meet the budget in `docs/PRODUCT.md`.
- `DESIGN.md`, `docs/PRODUCT.md`, ADR 0007 and the screenshots describe what ships.
