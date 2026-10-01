# Design Brief: Daily Tracker — "System Interface"

## How to use this brief

This is the reference document for the Daily Tracker interface. Each of the five pages below also exists as its own ready-to-paste prompt file, stitch-1-today.txt through stitch-5-settings.txt, each already containing the Design System paragraphs plus that one page's paragraphs. Paste a whole file as one prompt; never paste this entire document at once, since the file-level How to use notes and page headings are not meant to be read by Stitch itself.

Best workflow: generate all five screens inside one Stitch project, not five separate sessions, since Stitch shares style context better within a single project. After the first screen is generated, open Stitch's Design System panel and set the typography there explicitly, Manrope for text and JetBrains Mono for numbers, then select all screens (Shift-click) and apply that design system to all of them at once. That panel does not update automatically; the screens must be selected first.

The coin icon is a custom asset, not a standard color or type token, so it will not sync through the Design System panel. Whenever it looks inconsistent across screens, select the affected screens together and send one identical prompt describing it precisely, rather than re-describing it slightly differently per screen.

If any single generation comes back blank or incomplete, retry the exact same prompt once before changing anything.

Reference character used throughout every screen, for consistency if any single screen is regenerated later: Rank E, Level 3, 65 XP, Wallet 65, Streak 5, title Konsisten 7 hari, stats Str 16, Vit 12, Int 20, Disc 10, Soc 7.

## Design System

Daily Tracker is a personal web app that turns daily habits into quests: completing tasks earns points, raises stats and rank, and missing tasks has consequences. Concept: a dark status window, like the system overlay in a story about someone quietly becoming stronger. Restrained at first, more striking as rank rises. It is not a fantasy pixel-art game and not a hacker terminal. All text in the interface is plain, direct language. Render every label, title, button and message exactly as written in the page descriptions below, word for word, in sentence case. Do not add any extra labels, status strings, version numbers, IDs, sync indicators, capacity counters, decorative codes or footer text. There is no footer on any page.

Base colors in dark mode: page and panel background is a near black with a cold blue cast, hex 0A0E14. Panel surfaces, dividers and empty bar tracks use dark steel blue, hex 1A2230. Primary text is pale cool white, hex DCE8F0. Secondary text and labels use slate blue, hex 5B6B7A. Warning amber, hex E8544A, is used only for penalty and warning states.

Light mode swaps the background to very pale cold white, hex F2F5F8, primary text to near black blue, hex 0F1620, and surfaces to light gray blue, hex DCE3EA.

Buttons always use one fixed action color, signal blue hex 2FA8E8 with dark text, at every rank, so they never look disabled. Completion check icons are also signal blue.

The current rank sets an accent color used only for the corner brackets, the rank chip, the level number, the XP bar fill and the radar chart, so the interface grows more striking as the user ranks up. Rank E is soft steel blue, hex 7FB2D9. Rank D is signal blue, hex 2FA8E8. Rank C is steady teal, hex 4FD1A8. Rank B is deep violet, hex 9B6FE8. Rank A is amber gold, hex F0A93A. Rank S is radiant gold, hex FFE9A8, with the strongest glow; lower ranks have a subtler glow.

Glow is allowed only on the four corner brackets, the rank letter, the rank chip, the level number, and the one time level up or rank up moment. Everything else is flat with a plain one pixel border, no drop shadows and no gradients.

Typography: Manrope for all text, including navigation, buttons, section headers and labels, always in sentence case, never uppercase and never letter spaced. JetBrains Mono only for numeric values such as points, levels, XP, stat values, streak counts and dates.

Layout is left aligned, with flat panels, thin one pixel hairline borders, minimal border radius, and lists made of flat rows separated by hairline dividers rather than nested cards. All rows in a list have the same visual weight; no rows are dimmed. Progress and stat bars are thin, two to three pixels, on a steel track. The one signature device is a clearly visible L shaped corner bracket, about 24 pixels per side and 2 pixels thick, at each corner of a screen's main panel, colored in the current rank accent, never repeated on inner elements. Icons are simple outline icons only, no emoji, no filled icons, no illustration, with one exception: the coin icon described below.

Effort tier colors, used for task variants: Ringan is steady teal, hex 4FD1A8. Sedang is signal blue, hex 2FA8E8. Berat is warning amber, hex E8544A.

A small coin icon marks the spendable Wallet currency. It is a flat golden coin, about 16 pixels, round, in golden yellow hex F2C94C with a slightly darker rim, hex C9982E, and a small highlight. It is the only colored, non outline icon in the interface. Show it directly before the balance in the Wallet chip in the top bar, and directly before every reward cost, including locked rewards. Earned task points and XP stay plain numbers without a coin, so the spendable Wallet is always visually distinct from XP.

Every page has the same top bar. On the left the wordmark Daily Tracker, followed by five navigation items: Today, Tasks, Rewards, History, Settings, with the current page underlined in signal blue. On the right three small chips: Rank E, Streak 5, Wallet 65, with the rank chip in the rank accent and the other two in slate with monospace numbers. The Wallet chip shows the coin icon before its number. There is no avatar and no account control, since the app is local only.

## Page 1, Today

The screen uses the full desktop width, with two columns under the top bar. The content area has the rank accent corner bracket frame, soft steel blue for this rank E sample.

Left column, the status window. At the top, two readouts side by side: the label Rank above a large monospace E in the rank accent with its glow, and the label Level above a large monospace 3, right aligned. Directly under them, one line with the equipped title, styled subtly: Konsisten 7 hari. Then the line 9 / 70 xp to Level 4, with a thin XP bar in the rank accent, about thirteen percent filled. Below that, a five point radar chart with the axes Str, Vit, Int, Disc and Soc: a thin outline pentagon grid, with the user's values drawn as a shape filled in the rank accent at low opacity and a one pixel accent outline. Each vertex is labeled with the stat name and its monospace value: Str 16, Vit 12, Int 20, Disc 10, Soc 7.

Right column, from top to bottom. First, a system notification block with a thin border: a small title System message, and the text Complete at least 1 task in every stat today. Directly below it, a second notification block with an amber border and the text Penalty active: Soc needs 2 completions today.

Then the section Daily quest with the count 3/5 at the right. Five flat rows, each with a status icon, task name and points. Squat 15x2 set with a check icon and +3. Minum air 2L with a check icon and +3. Baca 10 halaman with an empty circle icon in slate and +3. Ibadah with a check icon and +3. Chat 1 temen with an amber warning triangle icon and the amber text 0/2.

After a divider, the section Rewards with two rows. Main game 2 jam with a coin icon and the number 60 in signal blue, and a Buy button. Nonton bioskop with a lock icon, muted, and a coin icon before the text 65 / 800.

## Page 2, Tasks

Page title Task library, with the small slate text 11 tasks next to it, and a signal blue button Add task at the top right.

Below, five sections with slate headers: Strength (Str), Vitality (Vit), Intellect (Int), Discipline (Disc), Social (Soc). Each task is a flat row with the task name, a small tag reading Anchor or Rotating, and on the right its points, plus small edit and delete icons.

A task with effort variants is a family: a heading row with the family name and its Rotating tag, then three indented sub rows, each showing a tier color marker, the tier name, a short description of what that tier requires, and its points on the right. A task with one difficulty is a single row with one points value, for example 5 pts.

Sample rows. Strength: Push up routine, Rotating, with Ringan, 10x2 set, 5 pts; Sedang, 20x3 set, 9 pts; Berat, 30x4 set or jogging 2km, 15 pts. Dead hang 60 seconds, Rotating, 8 pts. Morning plank 90 seconds, Anchor, 5 pts. Vitality: Minum air 2L, Anchor, 5 pts. Stretching 10 menit, Rotating, 4 pts. Intellect: Baca 10 halaman, Rotating, 5 pts. Belajar coding, Rotating, with Ringan, 30 menit, 6 pts; Sedang, 1 jam, 10 pts; Berat, 2 jam, 15 pts. Discipline: Ibadah, Anchor, 5 pts. Deep work, Rotating, with Ringan, 30 menit, 6 pts; Sedang, 60 menit, 10 pts; Berat, 90 menit, 15 pts. Social: Chat 1 temen, Rotating, 5 pts. Telepon keluarga, Anchor, 5 pts.

On the right, an editor panel with the corner bracket frame, titled Add task. Fields: Task name, with the value Push up routine. Stat, five options Str, Vit, Int, Disc, Soc, with Str selected. A toggle labeled Anchor task with the helper text Always appears daily, never rotates. A section titled Effort variants with the helper text Up to 3 tiers, containing three cards, each with a tier color marker, the tier name, a field labeled What to do and a field labeled Points. Ringan: 10x2 set, 5. Sedang: 20x3 set, 9. Berat: 30x4 set or jogging 2km, 15. Two buttons at the bottom: Save task in signal blue and Cancel as plain text.

## Page 3, Rewards

Page title Rewards, with the small slate text 5 items next to it in the same sans-serif font, and a signal blue button Add reward at the top right. A flat list of rewards. Each row shows the reward name, its cost in monospace with a coin icon before it, and a small slate text such as Bought 4 times, since rewards are repeatable. If the wallet covers the cost, the row has a Buy button. If not, the row shows a lock icon and the progress, for example 65 / 150. The lock and the progress are muted in slate, but the reward name stays in a readable, only slightly dimmed color.

Sample rows, with a current Wallet of 65: Main game 2 jam, 60, Bought 4 times, Buy button. Kopi susu santai, 35, Bought 8 times, Buy button. Beli buku baru, 150, Bought 0 times, locked, 65 / 150. Jajan favorit, 250, Bought 1 time, locked, 65 / 250. Nonton bioskop, 800, Bought 2 times, locked, 65 / 800.

## Page 4, History

Page title History. Below it, a panel with the corner bracket frame containing the chart and the table. At the top of the panel, the label XP trend at the left and the current total 65 xp at the right, in monospace. Then a thin line chart in the rank accent color on the dark background, with no fill, no gradient and no axis clutter, with x axis labels from 21 Sep to 27 Sep, and the line passing through these total XP values in order: 45, 20, 35, 34, 49, 56, 65, so it shows a sharp dip on 22 Sep and then recovers. Mark 22 Sep and 24 Sep with small amber markers for days that lost points, and mark 26 Sep with a small upward marker in signal blue for a level up.

Below the chart, a table with a header row in slate: Date, Str, Vit, Int, Disc, Soc, Net points. One row per day, newest first, with the date in monospace slate. A check mark means the stat was completed, a dash means it was missed, and a small empty circle means still pending. Net points are in signal blue when positive and amber when negative. The rows are: 27 Sep, checks for Str, Vit and Disc, empty circles for Int and Soc, +9. Then a highlighted single line with no points, reading Level up: 2 to 3, in the rank accent color with a brief glow. 26 Sep, checks for Str, Vit, Int and Disc, a dash for Soc, +7. 25 Sep, checks for all five, +15. 24 Sep, checks for Str, Int and Soc, dashes for Vit and Disc, -1. 23 Sep, checks for all five, +15. 22 Sep, dashes for all five, -25. 21 Sep, checks for Str, Vit, Int and Disc, a dash for Soc, +7. Highlighted lines never show points.

## Page 5, Settings

Page title Settings. A short list of flat rows with hairline dividers. Row Theme, with a light and dark toggle. Row Rank reference, expandable into a small read only table of the six ranks E to S with their level range, freezes per week, max points per task and point multiplier. Row Data, with two buttons: Export data and Import data.

## Known gaps

The level up and rank up reveal moment is described in the Design System as the one place glow and motion are spent, but no screen prompt for it has been written yet, since it is a transient overlay rather than a page. It should reuse the same corner bracket frame and rank accent colors as the five pages above.
