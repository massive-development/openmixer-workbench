---
name: OpenMixer
description: A warm matte DJ faceplate. Near-square parts, depth from lines, muted deck colours, every number in mono.
colors:
  bg: "#121211"
  well: "#0a0a09"
  panel: "#181816"
  control: "#22211e"
  control-hover: "#2b2a26"
  line: "#302e2a"
  edge: "#75716a"
  text: "#ece8df"
  text-2: "#bab4a7"
  text-3: "#9d978b"
  deck-a-amber: "#e3a24f"
  deck-a-amber-hover: "#eeb264"
  deck-b-slate: "#86a9cb"
  deck-c-sage: "#9cb585"
  deck-d-clay: "#c9705c"
  signal-red: "#ef5a3f"
  bg-light: "#ebe8e1"
  well-light: "#d9d5cc"
  panel-light: "#f4f2ec"
  control-light: "#ffffff"
  line-light: "#cbc6ba"
  edge-light: "#807b6e"
  text-light: "#141310"
  text-2-light: "#3f3b35"
  text-3-light: "#5f5a51"
  deck-a-amber-light: "#8f530b"
  deck-b-slate-light: "#2b5a86"
  deck-c-sage-light: "#43652d"
  deck-d-clay-light: "#983c2b"
  signal-red-light: "#c4301d"
typography:
  display:
    fontFamily: "Sansation, 'Source Sans 3', system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Sansation, 'Source Sans 3', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.236
  body:
    fontFamily: "'Source Sans 3', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Source Sans 3', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
  numeral:
    fontFamily: "'Ubuntu Mono', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
  numeral-large:
    fontFamily: "'Ubuntu Mono', ui-monospace, monospace"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "2px"
  md: "3px"
  full: "50%"
spacing:
  s1: "3px"
  s2: "5px"
  s3: "8px"
  s4: "13px"
  s5: "21px"
  s6: "34px"
components:
  control:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "26px"
  control-hover:
    backgroundColor: "{colors.control-hover}"
  control-compact:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    height: "21px"
  well:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.md}"
  knob:
    size: "34px"
    rounded: "{rounded.full}"
---

# Design System: OpenMixer

## Overview

**Creative North Star: "The Machined Faceplate"**

One faceplate, not nested cards. Three columns run top to bottom: deck A, the mixer, deck B, and deck B mirrors A so each deck reads from its outside edge. Parts are near-square (2-3px corners) like machined metal, surfaces are matte warm neutrals, and structure comes from etched 1px lines rather than shadow or light.

The system is quiet so the music is not. Colour is spent on the four deck hues and one signal red; everything else is warm grey. Controls follow hardware: dB-scaled faders, centre-detent EQ knobs, large pads. Every number is monospaced so values never jitter as they change.

**Key Characteristics:**
- Matte, warm, near-black ground with muted deck colours.
- Depth from 1px inset lines and tonal steps; no glow, no blur.
- Fibonacci spacing steps (3, 5, 8, 13, 21, 34); Compact density is Roomy shifted down one step.
- Deck colours are muted and chosen to stay distinct for colour-blind users (stated for A/B).
- Light mode darkens every colour to hold contrast in daylight.

**Supersedes `docs/design/E1-brand.md` on look.** That record's ember brand colour, "active means glow" rule, cool deck hues (glacier, orchid, mint, brass), violet-cast ground and motion tokens are replaced by this system. E1's tokens remain in the app until migrated.

## Colors

Warm matte neutrals with four muted deck hues. Dark is the default; light mode keeps the same roles with darker hues.

### Primary
- **Amber, Deck A** (#e3a24f; light #8f530b): Deck A's identity and its share of the waveform's low band. The warmest hue in the system.

### Secondary
- **Slate, Deck B** (#86a9cb; light #2b5a86): Deck B's identity.
- **Sage, Deck C** (#9cb585; light #43652d): Deck C.
- **Clay, Deck D** (#c9705c; light #983c2b): Deck D. Deepened from #cf8572 so it separates from Sage under red-green colour blindness (simulated worst-case difference roughly doubled).

### Tertiary
- **Signal Red** (#ef5a3f; light #c4301d): Playhead and record only. Never a deck colour.

### Neutral
- **Ink Well** (#0a0a09; light #d9d5cc): Recessed areas such as waveform wells.
- **Matte Ground** (#121211; light #ebe8e1): The window background.
- **Panel** (#181816; light #f4f2ec): The faceplate surface.
- **Control** (#22211e; light #ffffff): Buttons, pads and knob bodies; hover (#2b2a26).
- **Etched Line** (#302e2a; light #cbc6ba): 1px inset borders; the system's main structural device. Decorative; it separates, it does not identify.
- **Graphic Edge** (#75716a; light #807b6e): 3:1 against panel and control surfaces. Used where an edge is the only cue: dashed disabled/error edges and meter segments.
- **Warm Ivory** (#ece8df; light #141310): Primary text.
- **Text 2** (#bab4a7; light #3f3b35): Secondary text. 5.8:1 or better on every control surface.
- **Text 3** (#9d978b; light #5f5a51): Tertiary labels. At least 4.95:1 on every dark surface, including the hover tone (#2b2a26). Kept clearly below Text 2 so the hierarchy holds.

### Named Rules
**The Letter Beside Hue Rule.** A deck hue never appears without its letter where a deck is named.
**The Signal Rule.** Red marks the playhead and recording, nothing else.
**The Low-Band Rule.** In waveforms, low frequencies take the deck colour and highs sit in neutral on top.

## Typography

**Display Font:** Sansation (with Source Sans 3)
**Body Font:** Source Sans 3 (with system-ui)
**Label/Mono Font:** Ubuntu Mono (with ui-monospace)

**Character:** Sansation is the wordmark voice, used sparingly. Source Sans 3 carries all interface text; Ubuntu Mono carries every number.

### Hierarchy
- **Display** (700, 34px, 1.1): Page titles and wordmark.
- **Headline** (700, 21px, 1.236): Section headings. Sansation never goes below 21px.
- **Body** (400, 13px, 1.5): Descriptions and interface text.
- **Label** (500, 11px, 1.2): Control labels and swatch captions. The smallest tier for words. Fader dB scale ticks are the one exception, at 10px mono.
- **Numeral** (500, 13px mono): Values such as BPM, time and dB. **Numeral large** (500, 21px mono) for the primary readouts.

### Named Rules
**The Mono Numbers Rule.** Every number is Ubuntu Mono so values do not shift width as they change.
**The Wordmark Rule.** Sansation for headings and the wordmark only, at 21px and up.

## Layout

A single faceplate in three columns: deck A, mixer (320px Roomy, 260px Compact), deck B, with deck B mirrored. Two densities share one structure. Roomy uses control height 26, knob 34, pad 55, row 34. Compact shifts every step down one: height 21, knob 26, pad 34, row 26, so waveforms get the height. Spacing follows Fibonacci steps (3, 5, 8, 13, 21, 34 Roomy; 2, 3, 5, 8, 13, 21 Compact). The reference canvas is 1440x900.

## Elevation & Depth

Flat and line-built. Depth is an inset 1px line (`box-shadow: inset 0 0 0 1px` in the etched-line colour) plus a 1px top highlight (`inset 0 1px 0`, white at 4%). Raised controls add one small drop (`0 2px 3px` or `0 3px 5px` at 50% black); nothing else casts a shadow, and nothing glows. A selected deck outlines in its own hue mixed 40% into the line colour.

### Named Rules
**The Lines Not Light Rule.** Structure is drawn with 1px lines and tonal steps. No halos, no blur, no bloom.

## Shapes

Near-square. Controls and panels use 2px corners (3px on larger panels in Roomy); knobs and round indicators are circles. Everything else is a rectangle with an etched 1px edge, like machined parts.

## Components

### Controls (buttons, pads, toggles)
- **Shape:** 2px corners; 26px tall Roomy, 21px Compact.
- **Default:** Control surface (#22211e) with ivory text and an etched 1px inset line.
- **Hover:** Control hover (#2b2a26).
- **Hover:** one tonal step up (#2b2a26), text to ivory.
- **Pressed:** sinks to the Ink Well tone with a small inset shadow.
- **Focus (keyboard):** 2px ivory ring, 2px offset. Never removed.
- **On:** deck-hue tint at 22% over the control surface with a 70% deck-hue border; on+hover raises these to 32% and 85%.
- **Playing (transport):** solid deck fill with ground-colour text.
- **Disabled:** panel tone, dashed 1px edge, tertiary text, no hover.
- **Loop active / Sync locked:** the "on" state, plus a mono word ("LOCK") in the deck hue so the state reads without colour.
- **Clip:** top meter segment and the word CLIP in signal red, held until reset.
- Specified in canvas section 5 ("States") of `Design System.dc.html`, with live controls. Pads are shown set, playing and empty.

### Knobs
- 34px (26 Compact) circles with a centre detent on EQ knobs; value in mono beside them.

### Faders
- Hardware-style with a dB scale; deck colour marks the active deck.

### Waveform
- Ink Well background, low band in deck colour, highs in neutral; bar grid at 14% alpha and beat grid at 5%; playhead in signal red.

### Library rows
- 34px (26 Compact) rows with BPM, key and a Δ BPM / "vs A" key-compatibility cue against the playing track.
- **Hover:** one tonal step up. **Selected:** slate tint at 18% with a 55% edge. **Loaded on a deck:** deck letter in the deck hue plus a 40% deck edge. **Error:** dimmed, dashed edge, the reason in words ("can't read file"). Red is not used for errors.

## Website Surface

The marketing site (`Website Design System.dc.html`, canonical artboard 4a at 1280px, phone artboard 5a at 390px) uses the same tokens as the app, with these web-only conventions.

- **Cue gutter:** each section is marked "Bar 001, 017, 041 ..." in Ubuntu Mono in a 144px left gutter, so the page reads as a track. The sequence is the page's order, not decoration; do not add eyebrows above headings.
- **Spacing:** Fibonacci steps up to 55, 89 and 144 for section padding; 55px page margins at 1280, 21px at 390.
- **Primary action:** one solid Amber button (#e3a24f, hover #eeb264, text #121211), 55px tall, labelled for what it does ("Build for Linux" while there are no binaries). Secondary is a 1px etched outline. On phones both go full width at 44px or taller.
- **Code blocks:** Ink Well ground, 1px etched edge, Ubuntu Mono 13-14px, horizontal scroll rather than wrapping; each has a keyboard-reachable Copy control that changes to "Copied".
- **Waveform art:** low band in Amber (Deck A), highs in Slate (Deck B) or ivory; no glow.
- **Focus and motion:** 2px ivory ring with a 4px ground-colour halo so it reads on both dark and the cream canvas; all animation stops under `prefers-reduced-motion`.
- **Claims:** status words are "Alpha" and the real tag (v0.1.0-alpha.1); the licence is AGPLv3. Nothing on the page states a version, platform or comparison that the repo cannot back.

## Do's and Don'ts

### Do:
- **Do** build structure with 1px etched lines and tonal steps.
- **Do** set every number in Ubuntu Mono.
- **Do** reserve signal red (#ef5a3f) for the playhead and record.
- **Do** mirror deck B against deck A.
- **Do** use the Fibonacci steps, and shift one step down for Compact.

### Don't:
- **Don't** add glow, blur or bloom to show an active state.
- **Don't** use Sansation below 21px.
- **Don't** go below 11px for a label, or below 12px for running prose; the only 10px text is the fader dB scale.
- **Don't** rely on hue alone to name a deck; always pair it with the deck letter (A–D).
- **Don't** round corners beyond 3px on parts.
