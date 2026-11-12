# Product

<!-- impeccable:product-schema 1 -->

Scope: the OpenMixer website and the design-system artifacts in this directory. The DJ app's own bar lives in `../PRODUCT.md`; brand tokens in `../design/E1-brand.md`.

## Platform

web

## Users

Working DJs: people who play regular sets and already use djay, Serato, Rekordbox or Traktor, and will give a new program one session. Website visitors are these same DJs evaluating a switch. Open-source contributors are secondary.

## Product Purpose

OpenMixer is a free, open-source DJ application (Linux first; Windows and macOS to follow), a native desktop app written in Rust with GPUI. It aims for djay-Pro-class capability (multi-deck mixing, effects, sync, BPM/key analysis, stem separation, Automix, controller support) with an interface that reads at a glance. The website exists to get a working DJ to download it and try a session. This directory holds the design-system artifacts (app, website, icon, splash) that define how it looks.

## Positioning

A free, AGPLv3-licensed DJ program that a working DJ would choose over paid incumbents, with its own look rather than a copy of theirs. Its clean-room origin (original names, artwork, icons, layouts) is part of the claim.

## Operating Context

The app is used in dark rooms, mid-set, where waveforms, numerals and lit state must read instantly. The website and artifacts here are static HTML files (`*.dc.html`, `Website Pages.html`) under `docs/design-system/`. Source repo: github.com/massive-development/openmixer.

## Capabilities and Constraints

- Website pages carry Download and GitHub calls to action and state the AGPLv3 license.
- Clean-room rule (ADR 0001): no names, logos, artwork, icons, screenshots, manual text or pixel layouts from other DJ programs. Common layout conventions are free to use.
- Built-in app themes: Midnight Glass (`dark`, default), Daylight Frost (`daylight`), Harbour Night (`harbour`).
- Download availability per OS and release status are not confirmed here; do not invent them.

## Brand Commitments

Name: OpenMixer. Brand idea from `../design/E1-brand.md`: a lit console in a dark room. Ember is the reserved signature colour for brand marks and "now" cues, never a deck accent. The default look is OpenMixer's own, not a familiar-feeling scheme. These carry over from the app's brand record; any visual decisions beyond them are left to design work.

## Evidence on Hand

- App screenshots in `../screenshots/` (dark, daylight, meters lit, sampler open, stems page); known defects in `../screenshots/REVIEW.md`.
- Existing design-system and website artifacts in this directory.
- Absent, and not to be fabricated: testimonials, user counts, benchmarks, pricing, named DJ endorsements. Harbour Night has no screenshot yet.

## Product Principles

1. Look, feel and smoothness decide an evaluation; reliability is the precondition.
2. Show the music: waveforms and real numerals over decoration.
3. Own the look, share the conventions: distinct to OpenMixer, familiar in layout.
4. Depth over breadth; honest claims only (no feature race, no invented proof).
5. Free and open: AGPLv3 and the clean-room story are stated plainly.

## Accessibility & Inclusion

No product-specific standard established. The app's brand record sets contrast floors for numerals (7:1) and lit controls (3:1); not confirmed as a website requirement.
