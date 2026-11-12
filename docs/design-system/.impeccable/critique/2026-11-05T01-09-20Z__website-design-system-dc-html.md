---
target: Website Design System.dc.html
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:/home/brandon/projects/openmixer/docs/design-system/Website Design System.dc.html"
target_fingerprint: "sha256:0fa33ee20c003b93335b34be0c8002bcb2a2b44c305ed164d4ccf727bc2340fd"
target_path: /home/brandon/projects/openmixer/docs/design-system/Website Design System.dc.html
timestamp: 2026-11-05T01-09-20Z
slug: website-design-system-dc-html
---
Method: dual-agent (A: a4a2cef9dc779d068 · B: ae3dcc1080d003cb5). No browser tool; source and detector only.

Score 19/32 (heuristics 7 and 10 n/a), Acceptable.
Heuristics: 1=3, 2=3, 3=2, 4=2, 5=2, 6=3, 8=2, 9=2.

Specificity: mostly authored (bar-numbered timeline, 33 1/3 rpm, timecode roadmap); palette is the superseded E1 indigo/pink/glow world, not DESIGN.md.
Detector: 141 findings (nested-cards 53, numbered-section-labels 24, design-system-color 17, dark-glow 9, design-system-radius 7, gradient-text 7, low-contrast 6, cramped-padding 6, hero-eyebrow-chip 5, oversized-h1 4, cream-palette 1, skipped-heading 1); many inflated by canvas chrome.

Priority issues:
- [P0] Licence mismatch: AGPLv3 x15 vs GPLv3 in PRODUCT.md. /impeccable clarify
- [P1] Palette contradicts DESIGN.md (indigo/pink/cream, glows, gradient text). /impeccable colorize then document
- [P1] Placeholders {{ heroD }}/{{ heroC }}, invented versions, unsupported Compare claims. /impeccable clarify
- [P2] "Download for Linux" leads to cargo build. /impeccable onboard
- [P2] No media queries, focus styles or reduced-motion. /impeccable adapt then harden
- [P3] Too many sections (about 11). /impeccable distill
