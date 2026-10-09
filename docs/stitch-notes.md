# Stitch notes (not for implementation)

The five screens were generated in Stitch from one prompt file per page (`stitch-1-today.txt` to `stitch-5-settings.txt`). Each file holds the Design System paragraphs plus one page's paragraphs. These notes are kept only for regenerating a screen. Coding agents do not need them.

- Paste a whole page file as one prompt. Never paste the entire design brief, because the notes and page headings are not meant to be read by Stitch itself.
- Generate all five screens inside one Stitch project. Stitch shares style context better within a single project.
- After the first screen is generated, open Stitch's Design System panel and set the typography explicitly: Manrope for text and JetBrains Mono for numbers. Then select all screens (Shift-click) and apply that design system to all of them at once. The panel does not update automatically; the screens must be selected first.
- The coin icon is a custom asset, not a standard color or type token, so it does not sync through the Design System panel. When it looks inconsistent across screens, select the affected screens together and send one identical prompt that describes it precisely.
- If a single generation comes back blank or incomplete, retry the exact same prompt once before changing anything.
- The level up and rank up moment was a known gap in the Stitch prompts. It is now specified for implementation in `design.md` section 6.
