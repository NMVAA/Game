# Football Life

A **mobile-first 2D footballer career and adult personal-life simulation**. This project replaces the previous Three.js Pokrov driving game in the same repository. The earlier code remains only in Git history; it is not included in the new working tree or deployment.

## Play

https://nmvaa.github.io/Game/

Create a 21-year-old professional footballer. Play decisions in a compact 2D top-down match, train skills, progress through a 14-match league season, negotiate transfers through your agent, buy property and cars, and make choices about your relationships.

**Personal life is 21+**: all romantic characters are explicitly adult, and the game includes dating, living together, commitment, marriage, breakups, nightlife, and repercussions on a football career. **There are no children.** No explicit sexual imagery.

## Features in initial build

- Mobile-first UI, five bottom navigation tabs, phone-sized touch targets and safe areas.
- Fictional eight-club football universe with double round-robin seasons, standings and player statistics.
- Active 2D match screen: pass, dribble, shoot and press, each with a different probabilistic effect; plus quick simulation.
- Daily schedule and training with condition, morale, stress and form.
- Club contracts, salaries, bonuses, agent counteroffers, accept/reject and transfer consequences.
- Four adult characters with relationships, trust, dates and transitions to living together and marriage.
- Purchases and leisure spending affect personal reputation, finances and condition.
- Persistent game stored locally with versioned PWA offline shell; no external API is needed.

## Tech

Plain HTML, CSS and browser-native ES modules (JavaScript). No installation or build process. GitHub Actions publishes the repository root as a static GitHub Pages site.

No automated tests or test workflow steps, as requested.

## Scope

This is an initial playable original game prototype, not FIFA software and not an officially licensed football database. Real football club names, imagery and official licenses are not included. Match view is a tactical 2D visualisation rather than direct real-time football controls. The simulation has abstractions and room for future expansion.

## Controls

Tap navigation tabs, daily actions, match actions and transfer choices. Progress saves automatically to localStorage. Clearing browser site data will erase your save. Previous Pokrov-game saves are left untouched by the new save key.
