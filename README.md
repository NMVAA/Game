# Football Life 4.0 — Пам’ять персонажів і наслідки

Mobile-first React + Motion PWA. Оригінальна 2D-кар’єра футболіста і доросле особисте життя (21+) з двома інтерактивними свайп-виборами. **Без дітей**, без відвертого сексуального зображення.

## Version 4.0.0

- **Пам’ять окремих персонажів**: тренер, агент, капітан і кожен дорослий партнер пам’ятають конкретні вчинки, образи, взаємні зобов’язання й примирення. Після розриву історія колишнього партнера не зникає.
- **Обіцянки** з часовими рамками. Дотримане слово може збільшити довіру та лояльність; порушене має відкладені наслідки.
- **Причинно-наслідкові ланцюги**, що тривають ігровими тижнями: таємні переговори → питання клубу → документи → конфлікт зі складом; сварка з капітаном → роздягальня → роль у команді; трансфер → переїзд → компроміс або криза стосунків.
- **Механічні наслідки**, а не лише текст: підтримка тренера визначає ризик виходу з лави запасних; стосунки з капітаном впливають на зіграність у матчах; агентська довіра змінює фінансові умови й шанси переговорів.
- **Журнал пам’яті**: видно довіру, накопичені образи, останню згадку персонажа, відкриті обіцянки, стан стосунків із клубом і агентом та кількість майбутніх наслідків.
- **Існуючі кар’єри мігрують** зі схеми історії v2 у v3 зі збереженням грошей, статистики, стосунків, старих виборів і запланованих подій.
- **Два свайп-вибори** без вкладок: картка інтерактивно рухається за пальцем; якщо вибір неможливий, повертається назад. Сюжет іде далі автоматично.
- Текст звичайної сцени до 20 слів, важливої — до 100 слів.

**Обмеження:** це оригінальна ігрова симуляція, не повна реконструкція футбольної індустрії. Наслідки й баланс ускладнено, але їхню достовірність на реальному телефоні потрібно оцінювати під час гри.

**Жодних автоматизованих тестів**: на прохання власника проєкту вони не додаються. GitHub Actions виконує лише встановлення залежностей, збірку й публікацію; успіх збірки не є доказом відсутності помилок під час гри.

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
