# Football Life — React + Motion

Mobile-first 2D football career and adult personal-life interactive game. The screen fills the available mobile viewport; it is not constrained to a centered 700px column.

## Play

https://nmvaa.github.io/Game/

## Controls

- Swipe the story artwork **left** or **right**. The card visibly follows your finger, rotates and previews the corresponding outcome. Release beyond the threshold to commit your choice; otherwise the card springs back.
- The two large lower buttons provide exactly the same choices without swiping.
- The game advances automatically to the next scene; no tabs or navigation menus.
- The journal button shows saved decisions, consequences and relationships.
- 21+ romance, nightlife and personal situations; all partners 21 or older, no children, no explicit sexual depiction. Ordinary scenes are at most 20 words; rare major scenes can be up to 100.

## Real consequences

The story module tracks delayed consequences: agent and contract disputes, partners' trust, private photos, sponsorship conditions, nightlife repercussions, training, fatigue, finances, and transfers. The player's decisions can trigger later scenes, influencing the football career and personal relationships.

The original footballer save format is preserved in localStorage under `football-life-save-v1`. Do not clear the app's data to update.

## Stack

React 19, Motion for React, Vite, vite-plugin-pwa/Workbox. Static build deployed by GitHub Actions to GitHub Pages at /Game/. App shell precached for offline use and the PWA checks for updates.

No automated tests were created or configured, as requested. A successful build verifies only that bundles compile and deploy; it does not prove runtime or device UX is bug-free.

All clubs and characters are fictional. The game is an original work, not FIFA software.
