# Handoff: Лендинг «Личная CRM»

## Overview
Одностраничный статичный лендинг личной CRM. **Единственное целевое действие — перейти в приложение** (все кнопки ведут на один URL приложения, напр. `https://app.example.com` — заменить на реальный).

Стек: **Astro + Tailwind CSS 4**, статическая сборка (`output: 'static'`), без клиентского JS.

## About the Design Files
Файлы в `reference/` — **дизайн-референсы в HTML**, а не продакшн-код. Задача — воссоздать их в Astro + Tailwind 4 по принятым там паттернам (компоненты `.astro`, утилиты Tailwind, токены через `@theme`). Референсы открываются в браузере напрямую (`reference/Landing Mobile.dc.html`, `reference/Landing Desktop.dc.html`; рядом лежит `support.js`, нужный только для просмотра).

## Fidelity
**High-fidelity.** Цвета, шрифты, размеры, отступы и тексты финальные. Воспроизводить точно.

## Breakpoints / responsive
Одна страница, две раскладки:
- **Mobile (< 768px)** — референс `Landing Mobile.dc.html`, проектная ширина 390px. Контент в одну колонку, горизонтальные поля 20–24px.
- **Desktop (≥ 768px, `md:`)** — референс `Landing Desktop.dc.html`. Контейнер `max-width: 1200px`, поля 40px, по центру.
- Desktop-сетки построены на `repeat(auto-fit, minmax(300–340px, 1fr))` — на промежуточных ширинах сами складываются в 1 колонку.
- Крупные заголовки на desktop — `clamp()` (значения ниже).
- В мобильной версии рамки/тени вокруг страницы в референсе — только для презентации; на сайте страница во всю ширину, фон `#f6f2ec`.

## Design Tokens

### Цвета
| Токен | Hex | Где |
|---|---|---|
| `bg` | `#f6f2ec` | фон страницы, фон карточек в «Решении», фон кнопки в CTA |
| `bg-alt` | `#ede5da` | фон секции «Решение» |
| `ink` | `#1f1915` | основной текст, заголовки |
| `ink-2` | `#2a231e` | текст пунктов списков |
| `muted` | `#3d342e` | подзаголовки, описания |
| `accent` | `#9a5a3c` | надзаголовки (eyebrow), курсивные акценты в заголовках, номера, иконки |
| `accent-soft` | `#b47d60` | фон основных кнопок, фон блока CTA, рамка кнопки в шапке |
| `accent-soft-hover` | `#a56e52` | hover основных кнопок |
| `line` | `#e7dccf` | разделительные линии 1px |
| `cta-text-2` | `#fff8f2` | подзаголовок в CTA |
| `cta-text-3` | `#fbeee4` | eyebrow и мелкие подписи в CTA |
| `cta-btn-text` | `#5e3420` | текст кнопки на светлом фоне в CTA |

Tailwind 4:
```css
@import "tailwindcss";
@theme {
  --color-bg: #f6f2ec; --color-bg-alt: #ede5da;
  --color-ink: #1f1915; --color-ink-2: #2a231e; --color-muted: #3d342e;
  --color-accent: #9a5a3c; --color-accent-soft: #b47d60; --color-accent-soft-hover: #a56e52;
  --color-line: #e7dccf; --color-cta-btn-text: #5e3420;
  --font-serif: "Playfair Display", serif;
  --font-sans: "Manrope", sans-serif;
}
```

### Шрифты (Google Fonts, кириллица)
- **Playfair Display** — ital,wght 400..700 (заголовки, названия пунктов, номера). Курсив = акцентные слова.
- **Manrope** — 400, 500, 600, 700 (основной текст, кнопки, eyebrow).
- Лучше подключить локально (`@fontsource-variable/playfair-display`, `@fontsource-variable/manrope`) с `font-display: swap`.

### Типографика
| Роль | Mobile | Desktop |
|---|---|---|
| Eyebrow | Manrope 11px, uppercase, letter-spacing .32em, `accent` | 12px |
| H1 | Playfair 500, 41px, lh 1.08, ls -.025em; вторая строка italic 400 `accent` | `clamp(44px,7vw,84px)`, lh 1.04, ls -.03em |
| H2 короткий («Знакомо?», «Что изменится») | Playfair 40px, lh 1.05, ls -.025em | `clamp(44px,6vw,72px)`, lh 1 |
| H2 длинный («Решение») | Playfair 500, 29px, lh 1.18 | `clamp(30px,3.6vw,46px)`, lh 1.15, max-width 860px |
| H2 CTA | Playfair 500, 32px, `white-space:nowrap` | `clamp(36px,5.5vw,68px)` |
| Подзаголовок hero | Manrope 15px, lh 1.5, `muted` | 18px, lh 1.55, max-width 560px |
| Название пункта | Playfair 500, 21–22px, ls -.02em | 26–28px |
| Описание пункта | Manrope 12px (hero) / 14–15px (секции) | 15–18px |
| Номер 01–05 | Playfair italic, 18–20px, `accent` | 22–24px |
| Кнопка | Manrope 600, 16px | 17px |

Все заголовки — `text-wrap: balance`, абзацы — `text-wrap: pretty`.

### Радиусы / прочее
- Кнопки: `9999px` (pill). Высота 52px (mobile hero), 56px (mobile CTA), 58px (desktop hero), 60px (desktop CTA), 42px (кнопка в шапке).
- Карточки «Решения»: radius 16px (mobile) / 20px (desktop), padding 18px / 30px.
- Блок CTA: radius 24px (mobile, отступ 12px от краёв) / 32px (desktop).
- Фото: radius 6px (mobile) / 8px (desktop).
- Линии: `1px solid #e7dccf`. Теней в продакшене нет.

## Sections (по порядку)

### 0. Шапка (только desktop)
Flex, space-between, padding 28px 40px. Слева eyebrow «ЛИЧНАЯ CRM» (600). Справа кнопка-контур «Начать бесплатно»: border 1px `accent-soft`, текст `accent`, 14px/600, padding 0 22px; hover — фон `accent-soft`, текст белый.

### 1. Hero
Всё по центру.
- Eyebrow «Личная CRM» (только mobile; на desktop он в шапке).
- H1: строка 1 «Ваш круг общения» (`ink`), строка 2 *«в одном месте»* (italic 400, `accent`). Каждая строка — `display:block`; на mobile — `nowrap`.
- Подзаголовок: «Личная CRM помогает помнить детали и поддерживать связь с друзьями, коллегами, партнёрами и новыми знакомыми.»
- Кнопка «Начать бесплатно» — фон `accent-soft`, белый текст, ширина по контенту (padding 0 34px mobile / 0 40px desktop).
- Ниже — блок «фото + функции»:
  - **Mobile**: CSS grid `160px 1fr`, column-gap 14px, margin-top 26px. Фото (`notebook.png`, `aspect-ratio 356/648`, `object-fit: contain`, без обрезки) занимает колонку 1, строки 1–3; под ним линия. Колонка 2, строки 1–3: Карточки, Напоминания, Даты (каждая ячейка тянется на высоту строки, линия снизу — линия под «Датами» совпадает с линией под фото). Строка 4: «Поиск» (кол. 1) и «Заметки» (кол. 2), выровнены по верху, без нижней линии.
  - **Desktop**: grid `auto-fit minmax(300px,1fr)`, gap 48px, max-width 960px, margin-top 72px, `align-items:center`. Слева фото (max-width 340px), справа вертикальный список из 5 пунктов (Карточки, Напоминания, Даты, Заметки, Поиск) с линиями между, padding 22px 0, иконка 32px.
  - Пункт = иконка (stroke `accent`) + название (Playfair) + описание.
  - Тексты пунктов:
    - Карточки — «Где познакомились, о чём говорили, интересы, семья»
    - Напоминания — «Подскажет, кому пора написать»
    - Даты — «Дни рождения и встречи в одном календаре»
    - Заметки — «Главное после встречи: идеи, новости, вопросы и следующие шаги.»
    - Поиск — «Введите то, что помните, текстом или [иконка микрофона]» (иконка `mic.svg` инлайн, 13px mobile / 15px desktop, `vertical-align:-2px`, цвет `accent`).

### 2. Проблема
Верхняя линия `line`. Padding: 56/24/60px mobile, 110/40px desktop.
- Eyebrow «Проблема», H2 *«Знакомо?»* (italic 400, `accent`).
- Список 5 пунктов: номер 01–05 (ширина 28px / 36px) + текст; линии сверху у каждого, снизу у последнего. Padding 16px 0 / 22px 0.
  1. Контакты разбросаны по телефону, мессенджерам, почте и визиткам.
  2. Вы обещали созвониться через месяц и вспомнили об этом через полгода.
  3. Встречаете человека и не можете вспомнить, как его зовут и какой проект он вёл.
  4. Пропускаете дни рождения и важные даты тех, кто вам дорог.
  5. Полезные знакомства постепенно угасают просто потому, что вы забываете выходить на связь.
- Вывод (Playfair 24px mobile / 28px desktop, lh 1.3): «Вам ведь не всё равно. *Просто удержать в голове сотни людей невозможно.*» (вторая фраза italic `accent`).
- **Mobile**: всё в колонку по центру, вывод после списка. **Desktop**: 2 колонки (`auto-fit minmax(340px,1fr)`, gap 64px): слева eyebrow + H2 + вывод (max-width 420px), справа список.

### 3. Решение
Фон `bg-alt`. Всё по центру.
- Eyebrow «Решение». H2: «Личная CRM собирает всё о ваших контактах в одном месте и подсказывает, *когда пора напомнить о себе*».
- 5 карточек (фон `bg`): иконка + название + описание. Mobile — колонкой, gap 10px, иконка слева. Desktop — grid `auto-fit minmax(300px,1fr)`, gap 16px, иконка сверху (34px), gap 18px.
  - Карточка на каждого человека — «Где познакомились, о чём говорили, проекты, интересы, общие планы, семья.»
  - Напоминания о контакте — «Задайте, как часто хотите общаться, и сервис подскажет, кому пора написать.»
  - Важные даты — «Дни рождения, годовщины, договорённости и встречи — в одном календаре.»
  - Заметки после встреч — «Запишите главное за 30 секунд, можно голосом.»
  - Быстрый поиск — «Найдите человека по городу, сфере деятельности или тегу.»

### 4. Выгоды
- Eyebrow «Выгоды», H2 «Что *изменится*».
- 5 пунктов: строка «номер + название» (baseline), под ней описание с отступом слева 34px / 42px. Линия сверху у каждого. Mobile — колонкой (последний с нижней линией); desktop — grid `auto-fit minmax(320px,1fr)`, column-gap 56px.
  1. Вы перестанете терять людей — Ни одно важное знакомство не затеряется в списке контактов.
  2. Разговоры станут глубже — Вы помните детали, и люди это ценят.
  3. Развивайте деловые связи — Поддерживайте контакт с людьми, с которыми интересно обмениваться опытом, работать, создавать новое и зарабатывать.
  4. Меньше неловкости — Не нужно гадать, как зовут собеседника или о чём вы договаривались.
  5. Свободная голова — Помнить за вас будет сервис, а вы займётесь самим общением.

### 5. Призыв к действию
Блок с фоном `accent-soft`, белый текст, по центру. Padding 52/24/40px mobile, 96/32/80px desktop.
- Eyebrow «Личная CRM» (`#fbeee4`).
- H2: «Близкие люди — *ближе!*» (одна строка).
- Текст: «Начните с 10 самых важных для вас людей.» (`#fff8f2`).
- Кнопка **«Начать»**: фон `bg`, текст `#5e3420`, 700. Mobile — на всю ширину; desktop — padding 0 56px. Hover — фон `#fff`.
- Подпись (`#fbeee4`, 12px / 14px): «Настройка за 5 минут · Ваши персональные данные видите только вы» (на mobile — две строки).

## Interactions & Behavior
- Все кнопки — обычные `<a href={APP_URL}>`. Вынести `APP_URL` в константу/env (`import.meta.env.PUBLIC_APP_URL`).
- Hover: смена фона (см. токены), `transition: background-color .15s`.
- Нужен видимый `:focus-visible` (outline 2px `accent`, offset 3px).
- Анимаций нет. JS не нужен.

## State Management
Нет — статичная страница.

## SEO / meta
- `<title>`: «Личная CRM — Помните всех, кто для вас важен» (в исходнике опечатка «важе»).
- `lang="ru"`, meta description = подзаголовок hero.
- Фото: `alt=""` (декоративное) или «Блокнот и ручка на столе». Использовать `astro:assets` `<Image>` для оптимизации.

## Assets
- `assets/notebook.png` — фото блокнота (356×648). Желательно заменить исходником в высоком разрешении (×2–×3).
- `assets/icons/*.svg` — линейные иконки (card, bell, calendar, note, search, mic), `stroke="currentColor"` → задавать цвет классом `text-accent`. Stroke 1.4 при 26px.

## Copy
Исходный текст лендинга — `copy/landing-text-source.md`. В дизайне исправлены опечатки («вёл», «персональные») и знаки препинания; финальные тексты — в разделе Sections выше.

## Suggested Astro structure
```
src/
  layouts/Base.astro          — <html lang="ru">, шрифты, meta
  components/Button.astro     — variant: solid | outline | light
  components/Eyebrow.astro
  components/sections/Hero.astro
  components/sections/Problem.astro
  components/sections/Solution.astro
  components/sections/Benefits.astro
  components/sections/Cta.astro
  data/content.ts             — все тексты массивами (пункты списков)
  pages/index.astro
```

## Files
- `reference/Landing Mobile.dc.html` — мобильная версия (390px).
- `reference/Landing Desktop.dc.html` — десктопная версия.
- `reference/assets/notebook.png`, `reference/support.js` — для просмотра референсов.
- `assets/` — ассеты для продакшена.
- `copy/landing-text-source.md` — исходный текст.
