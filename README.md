# Football Life

A **mobile-first 2D footballer career and adult personal-life simulation**. This project replaces the previous Three.js Pokrov driving game in the same repository. The earlier code remains only in Git history; it is not included in the new working tree or deployment.

## Play

https://nmvaa.github.io/Game/

Create a 21-year-old professional footballer. Play decisions in a compact 2D top-down match, train skills, progress through a 14-match league season, negotiate transfers through your agent, buy property and cars, and make choices about your relationships.

**Personal life is 21+**: all romantic characters are explicitly adult, and the game includes dating, living together, commitment, marriage, breakups, nightlife, and repercussions on a football career. **There are no children.** No explicit sexual imagery.

## Версія 2.0 — Life Choices

Гра тепер працює як єдиний потік ситуацій із **двома рішеннями**. Гравець свайпає ліворуч або праворуч чи натискає на одну з двох карток; після вибору сюжет одразу просувається. Нижньої панелі вкладок немає. Інтерфейс займає всю доступну висоту мобільного екрана.

Симулятор зберігає рішення, довіру партнера, клубу й агента, приватність, публічну репутацію, ризики скандалів, зарплату, форму, стрес і особисті кошти. Вибори запускають **відкладені події**, зокрема витік переговорів, конфлікти після трансферу, обговорення публічної поведінки, лікарські рекомендації, інвестиційні наслідки та особисті кризи.

Усі романтичні персонажі 21+. Стосунки, ревнощі, доросла близькість за взаємною згодою, шлюб, розриви та нічне життя впливають на кар'єру. Сексуальна близькість описується без відвертих деталей. Дітей немає.

Звичайні ситуаційні описи обмежені двадцятьма словами, а виняткові значущі сцени — ста словами. Після кожного рішення відбувається автоматичний перехід до наступної картки. Історію та наслідки можна відкрити з журналу у верхній частині екрана.

У грі вигадані клуби, професіональні футболісти, матчеві рішення та контрактні переговори. Прогрес зберігається у localStorage. Під час переходу з попереднього інтерфейсу збережений прогрес футболіста зберігається.

## Tech

Plain HTML, CSS and browser-native ES modules (JavaScript). No installation or build process. GitHub Actions publishes the repository root as a static GitHub Pages site.

No automated tests or test workflow steps, as requested.

## Scope

This is an initial playable original game prototype, not FIFA software and not an officially licensed football database. Real football club names, imagery and official licenses are not included. Match view is a tactical 2D visualisation rather than direct real-time football controls. The simulation has abstractions and room for future expansion.

## Controls

Swipe left/right or tap one of two choices; the story advances automatically. Progress saves automatically to localStorage. Clearing browser site data will erase your save. Previous Pokrov-game saves are left untouched by the new save key.
