# OSE Gygax '75 System Customizations Registry

This document serves as the authoritative registry of all custom modifications, rule enhancements, and UI tweaks maintained in the `ose-foundry-core-gygax75` fork of the official Old-School Essentials system for Foundry VTT (upstream: [`vance/ose`](https://github.com/vance/ose)).

Whenever upstream changes are merged or new features are introduced, consult this catalog to verify that active customizations are preserved and that deprecated features are systematically marked obsolete.

---

## Lifecycle Status Taxonomy

| Status | Badge | Description |
| :--- | :--- | :--- |
| **Active** | `🟢 Active` | Live in the fork, covered by tests, and actively running in the Gygax '75 world. |
| **Planned** | `🟡 Planned` | Audited from historical pre-v3 commits or backlog; recommended for restoration or active development. |
| **Obsolete** | `🔴 Obsolete` | Retired because upstream native OSE v3 or Foundry V14 ApplicationV2 implemented a better native equivalent. |
| **Ignored** | `⚪ Ignored` | Consciously omitted or declined (e.g. high maintenance burden, out of scope for Gygax '75 campaign rules). |

---

## Customization Master Matrix

| ID | Status | Category | Name | Primary Touchpoints |
| :--- | :--- | :--- | :--- | :--- |
| `GYGAX-001` | `🟢 Active` | Migration & Data | Setting Gate for Class/Race Items | `src/module/settings.ts`, `src/module/migration/index.ts` |
| `GYGAX-002` | `🟢 Active` | UI & Styling | Gygax '75 High-Res Login Art & Thumbnail | `assets/ose-system.webp`, `thumbnail.webp` |
| `GYGAX-003` | `🟢 Active` | UI & Styling | Compact Top-Center Game Pause Indicator | `src/scss/core.scss` |
| `GYGAX-004` | `🟢 Active` | Combat & Initiative | Fast Combat Tracker & Halfling Initiative | `src/module/combat/combatant.ts`, `combat-tracker.ts` |
| `GYGAX-005` | `🟢 Active` | Encumbrance | BECMI 2,400 cn Encumbrance Variant | `src/module/actor/data-model-classes/data-model-character-encumbrance.ts` |
| `GYGAX-006` | `🟢 Active` | Character Creation | Auto Stat Gen & Sub-Par Rerolls | `src/module/character-creation.js`, `character-header.html` |
| `GYGAX-007` | `🟢 Active` | Economy & Shopping | GP (Bank) Ledger & Shopping Cart Flow | `src/module/character-creation.js`, `character-gp-cost.js` |
| `GYGAX-008` | `🟢 Active` | Party Management | Party Sheet Rosters, Duty XP & Retention | `src/module/party-sheet.js`, `duty-xp.js`, `party-xp.js` |
| `GYGAX-009` | `🟢 Active` | Inventory | Container D&D & Nested Container Prevention | `src/module/actor/actor-sheet.js`, `character-sheet.js` |
| `GYGAX-010` | `🟢 Active` | Rules & Mechanics | DialogV2 Hit Dice Rolling & Name Scaling | `src/module/entity.js`, `src/lang/en.json` |
| `GYGAX-011` | `🟢 Active` | Tactical Combat | Combat Modifiers & Ammunition Tracking | `src/module/entity.js`, `src/module/settings.ts` |
| `GYGAX-012` | `🟢 Active` | Tactical Combat | Tactical Combat Hooks (Healing & Speed) | `src/module/tactical-combat-hooks.ts`, `src/ose.js` |
| `GYGAX-013` | `🟢 Active` | Active Effects | Effects Tab & Link Forwarding | `src/module/actor/actor-sheet.js`, `actor-effects-tab.html` |
| `GYGAX-014` | `🟢 Active` | UI & Styling | DialogV2 OSE Parchment & Styling Standards | `src/scss/apps.scss` |
| `GYGAX-015` | `🟡 Planned` | UI & Styling | Window Content Double Scrollbar Fix | `src/scss/core.scss` |
| `GYGAX-016` | `🟡 Planned` | UI & Styling | Character Sheet Notes Tab Responsive Flex | `src/scss/character.scss` |
| `GYGAX-017` | `🟡 Planned` | UI & Styling | Effects Tab Full-Height Inventory Sizing | `src/scss/actor-base.scss` |
| `GYGAX-018` | `🟡 Planned` | UI & Shopping | Shopping Cart Max Height & Currency Alignment | `src/scss/apps.scss` |
| `GYGAX-019` | `🟡 Planned` | Economy & Math | Bundle Cumulative Cost Math Model | `src/module/item/data-model-item.ts` |
| `GYGAX-020` | `🟡 Planned` | UI & Sheets | Item Sheet (Bundle) Visual Suffix Labels | `src/templates/items/*.html` |
| `GYGAX-021` | `🟡 Planned` | Macros & Hotbar | Macro Unlinked Token Resolution & Quoted Escaping | `src/module/helpers-macros.js` |
| `GYGAX-022` | `🟡 Planned` | Core Compliance | Modern User ID Reference in Whispers (`game.user.id`) | `src/module/helpers-dice.js`, `helpers-treasure.js` |
| `GYGAX-023` | `🟡 Planned` | Equipment & Tags | Custom Weapon Qualities: Penetrating & Reach | `src/module/config.ts`, `src/lang/en.json`, `assets/` |
| `GYGAX-024` | `🟡 Planned` | Classes & Rules | Gygax '75 Custom Classes for String Mode | `src/module/classes/gygax75-classes.ts`, `config.ts` |
| `GYGAX-025` | `🟡 Planned` | Monster Sheet | Monster Sheet RollTable Drop Hyperlink Labels | `src/module/actor/monster-sheet.js` |
| `GYGAX-026` | `🟡 Planned` | Monster Sheet | Monster Sheet Description Editor 100% Height | `src/scss/monster.scss` |
| `GYGAX-027` | `🔴 Obsolete` | Legacy Architecture| ApplicationV1 FormApplication Overrides | Various pre-v3 JS files |
| `GYGAX-028` | `🔴 Obsolete` | Manifests | `template.json` Custom Property Injections | `template.json` (removed upstream) |
| `GYGAX-029` | `🔴 Obsolete` | UI & Sizing | Hardcoded Sheet Window Pixel Dimensions | Legacy sheet constructors |
| `GYGAX-030` | `🔴 Obsolete` | Dialog Architecture| Legacy `.wait()` Dialog Pattern | Pre-ApplicationV2 dialog wrappers |

---

## Detailed Customization Catalog

### 🟢 Active Customizations

#### `GYGAX-001`: Setting Gate for Discrete Class/Race Items
* **Status**: `🟢 Active`
* **Category**: Migration & Data
* **Files**: [`src/module/settings.ts`](src/module/settings.ts), [`src/module/migration/index.ts`](src/module/migration/index.ts), [`src/templates/actors/character-sheet.html`](src/templates/actors/character-sheet.html)
* **Origin**: Commit `59fdbbe` (`v3.1.0-beta.2-gygax75.1`)
* **Description**: Adds the `enableClassItems` world setting (defaulting to `false`). When disabled, character sheets preserve single-string `system.details.class` and `system.details.title`, hide the upstream migration banner/buttons, and prevent automated data migration from destroying backward compatibility with existing campaign actors and macros.
* **Upstream Merge Guard**: Ensure `enableClassItems` checks remain intact during upstream migration updates.

#### `GYGAX-002`: Gygax '75 High-Res Login Art & World Thumbnail
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`assets/ose-system.webp`](assets/ose-system.webp), [`thumbnail.webp`](thumbnail.webp)
* **Origin**: Commit `75f2940` (`v3.1.0-beta.2-gygax75.2`)
* **Description**: Replaces the default upstream cover with the custom high-resolution Gygax '75 fantasy dungeon crawler splash art and world banner.
* **Upstream Merge Guard**: Upstream updates regularly overwrite `assets/ose-system.webp` and `thumbnail.webp`; restore custom binary assets after pulls.

#### `GYGAX-003`: Compact Top-Center Game Pause Indicator
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`src/scss/core.scss`](src/scss/core.scss)
* **Origin**: Commit `6d62733` (`v3.1.0-beta.2-gygax75.3`)
* **Description**: Restyles Foundry's default `#pause` overlay to a compact 48px badge positioned at the top-center margin (`top: 20px`, `transform: translate(-50%, 0) scale(0.5)`). Retains Foundry V14 click-through safety (`pointer-events: none`).
* **Upstream Merge Guard**: Check `src/scss/core.scss` on upstream pulls.

#### `GYGAX-004`: Fast Combat Tracker & Halfling Initiative
* **Status**: `🟢 Active`
* **Category**: Combat & Initiative
* **Files**: [`src/module/combat/combatant.ts`](src/module/combat/combatant.ts), [`src/module/combat/combat-tracker.ts`](src/module/combat/combat-tracker.ts), [`src/templates/combat/combat-tracker-combatant.hbs`](src/templates/combat/combat-tracker-combatant.hbs)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported to v3.0 ApplicationV2 in `e373913`
* **Description**: Streamlines OSE group and individual initiative with one-click side rolling, fast combatant cycling, and automated Halfling +1 individual initiative modifiers.
* **Upstream Merge Guard**: Upstream ApplicationV2 combat tracker rewrites.

#### `GYGAX-005`: BECMI 2,400 cn Encumbrance Variant
* **Status**: `🟢 Active`
* **Category**: Encumbrance
* **Files**: [`src/module/actor/data-model-classes/data-model-character-encumbrance.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance.ts), [`src/scss/character.scss`](src/scss/character.scss)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Implements the official BECMI/RC maximum load capacity of 2,400 cn alongside standard B/X 1,600 cn thresholds, supporting high-strength pack mules and deep dungeon haulage.
* **Upstream Merge Guard**: DataModel schema validations for character actors.

#### `GYGAX-006`: Auto Stat Generation & Sub-Par Rerolls
* **Status**: `🟢 Active`
* **Category**: Character Creation
* **Files**: [`src/module/character-creation.js`](src/module/character-creation.js), [`src/templates/actors/character-header.html`](src/templates/actors/character-header.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Provides automated 3d6 in order, 4d6 drop lowest, and standard array generation with automatic detection of "hopeless" / sub-par characters (highest score $\le 8$ or net negative modifiers) offering instant GM-approved rerolls.
* **Upstream Merge Guard**: Verify header actions on character sheet.

#### `GYGAX-007`: GP (Bank) Ledger & Shopping Cart Flow
* **Status**: `🟢 Active`
* **Category**: Economy & Shopping
* **Files**: [`src/module/character-creation.js`](src/module/character-creation.js), [`src/module/character-gp-cost.js`](src/module/character-gp-cost.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Supports banking and town economy with a discrete GP Bank balance that character creation and general shopping carts can draw from without manual coin deduction.
* **Upstream Merge Guard**: DialogV2 migration touchpoints.

#### `GYGAX-008`: Party Sheet Rosters, Duty XP & Retention
* **Status**: `🟢 Active`
* **Category**: Party Management
* **Files**: [`src/module/party-sheet.js`](src/module/party-sheet.js), [`src/module/duty-xp.js`](src/module/duty-xp.js), [`src/module/party-xp.js`](src/module/party-xp.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Enhances party oversight with active exploration rosters, retainer share deductions (1/2 XP for retainers), and duty XP bonuses.
* **Upstream Merge Guard**: Party sheet templates and calculations.

#### `GYGAX-009`: Container D&D & Nested Container Prevention
* **Status**: `🟢 Active`
* **Category**: Inventory
* **Files**: [`src/module/actor/actor-sheet.js`](src/module/actor/actor-sheet.js), [`src/module/actor/character-sheet.js`](src/module/actor/character-sheet.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Drag-and-drop item management for backpacks, sacks, and chests with recursive capacity math and strict protection against nesting containers inside containers.
* **Upstream Merge Guard**: Actor sheet item drag-and-drop handlers.

#### `GYGAX-010`: DialogV2 Hit Dice Rolling & Name-Level Scaling
* **Status**: `🟢 Active`
* **Category**: Rules & Mechanics
* **Files**: [`src/module/entity.js`](src/module/entity.js), [`src/lang/en.json`](src/lang/en.json)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Interactive level-up DialogV2 prompt implementing CON modifiers, minimum 1 HP gain, and name-level flat HP increments (+1 or +2 HP past level 9).
* **Upstream Merge Guard**: DialogV2 classes `["ose", "dialog"]` and `position` dimensions.

#### `GYGAX-011`: Tactical Combat Modifiers & Ammunition Tracking
* **Status**: `🟢 Active`
* **Category**: Tactical Combat
* **Files**: [`src/module/entity.js`](src/module/entity.js), [`src/module/settings.ts`](src/module/settings.ts), [`src/templates/dialogs/roll-dialog.html`](src/templates/dialogs/roll-dialog.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Situational combat modifiers (cover, rear attack, prone) and automatic consumption of linked missile ammunition on attack rolls.
* **Upstream Merge Guard**: Attack roll execution methods in `entity.js`.

#### `GYGAX-012`: Tactical Combat Hooks (Healing & Speed)
* **Status**: `🟢 Active`
* **Category**: Tactical Combat
* **Files**: [`src/module/tactical-combat-hooks.ts`](src/module/tactical-combat-hooks.ts), [`src/ose.js`](src/ose.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Event listeners tracking unconsciousness, natural healing limits, and tactical movement rate penalties during round execution.
* **Upstream Merge Guard**: System initialization hooks in `ose.js`.

#### `GYGAX-013`: Active Effects Tab & Link Forwarding
* **Status**: `🟢 Active`
* **Category**: Active Effects
* **Files**: [`src/module/actor/actor-sheet.js`](src/module/actor/actor-sheet.js), [`src/templates/actors/actor-effects-tab.html`](src/templates/actors/actor-effects-tab.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Embedded Active Effects management tab on character and monster sheets with link forwarding to originating spells, items, or conditions.
* **Upstream Merge Guard**: Actor sheet template tab registration.

#### `GYGAX-014`: DialogV2 Styling Standards (Parchment & Denim)
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`src/scss/apps.scss`](src/scss/apps.scss)
* **Origin**: Standardized in `b898fa8`, ported in `e373913`
* **Description**: Custom parchment backgrounds, dark borders, and legible typography applied to all `DialogV2` windows using classes `["ose", "dialog"]`.
* **Upstream Merge Guard**: Upstream SCSS overrides.

---

### 🟡 Planned Customizations (Slated for Restoration)

#### `GYGAX-015`: Window Content Double Scrollbar Fix
* **Status**: `🟡 Planned`
* **Category**: UI & Styling
* **Files**: [`src/scss/core.scss`](src/scss/core.scss)
* **Origin**: Commit `915db54`
* **Description**: Adds `.ose .window-content { overflow: hidden; }`. In Foundry V14 ApplicationV2 sheets, inner tabs handle their own scrolling; omitting `overflow: hidden` on `.window-content` produces annoying dual scrollbars.
* **Recommendation**: **Restore**. Zero risk, immediate UX fix.

#### `GYGAX-016`: Character Sheet Notes Tab Responsive Flex
* **Status**: `🟡 Planned`
* **Category**: UI & Styling
* **Files**: [`src/scss/character.scss`](src/scss/character.scss)
* **Origin**: Commit `02911faddebb`
* **Description**: Replaces upstream's rigid `min-height: 500px; overflow-y: visible;` with a responsive flex container (`height: 100%; flex: 1 1 0; min-height: 0;`), allowing the character notes editor to scale seamlessly when the window is resized.
* **Recommendation**: **Restore**. Eliminates sheet layout clipping on smaller viewports.

#### `GYGAX-017`: Effects Tab Full-Height Inventory Sizing
* **Status**: `🟡 Planned`
* **Category**: UI & Styling
* **Files**: [`src/scss/actor-base.scss`](src/scss/actor-base.scss)
* **Origin**: Commit `02911faddebb`
* **Description**: Adds `&.effects { height: 100%; }` to `.inventory` in `actor-base.scss`. Ensures the active effects list expands to fill the entire sheet body height rather than collapsing to minimal content height.
* **Recommendation**: **Restore**. Directly enhances `GYGAX-013`.

#### `GYGAX-018`: Shopping Cart Max Height & Currency Alignment
* **Status**: `🟡 Planned`
* **Category**: UI & Shopping
* **Files**: [`src/scss/apps.scss`](src/scss/apps.scss)
* **Origin**: Commits `33de686`, `2b45489`
* **Description**: Enforces `max-height: 450px; overflow-y: auto;` on `.ose.dialog.gp-cost .item-list` and sets right-aligned numeric alignment for currency columns, preventing long equipment lists from expanding off-screen.
* **Recommendation**: **Restore**. Prevents shopping dialog overflow during character generation.

#### `GYGAX-019`: Bundle Cumulative Cost Math Model
* **Status**: `🟡 Planned`
* **Category**: Economy & Math
* **Files**: [`src/module/item/data-model-item.ts`](src/module/item/data-model-item.ts)
* **Origin**: Commit `68f245d1`
* **Description**: Calculates item value as `(this.cost / this.quantity.max) * this.quantity.value` when `quantity.max > 0`. Corrects a critical math bug where partial ammunition bundles (e.g. 19 of 20 arrows) are priced at 19 times the entire bundle price (95 GP) instead of unit price (4.75 GP).
* **Recommendation**: **Restore**. Mathematically necessary for correct character wealth and encumbrance tracking.

#### `GYGAX-020`: Item Sheet (Bundle) Visual Suffix Labels
* **Status**: `🟡 Planned`
* **Category**: UI & Sheets
* **Files**: [`src/templates/items/*.html`](src/templates/items/)
* **Origin**: Commits `68f245d1`, `d4ed2e00`
* **Description**: Displays `(Bundle)` in cost and weight labels whenever `system.quantity.max > 0`, clarifying that listed prices and weights represent the whole package.
* **Recommendation**: **Restore**. Pairs with `GYGAX-019`.

#### `GYGAX-021`: Macro Unlinked Token Resolution & Quoted Escaping
* **Status**: `🟡 Planned`
* **Category**: Macros & Hotbar
* **Files**: [`src/module/helpers-macros.js`](src/module/helpers-macros.js)
* **Origin**: Commit `a27707b1`
* **Description**: Replaces deprecated `game.actors.tokens[speaker.token]` (broken in V12+) with `scene.tokens.get(speaker.token)?.actor` for synthetic tokens, and wraps macro command generation in `JSON.stringify()` to prevent syntax errors when rolling items with apostrophes (e.g. *Ogre's Club*).
* **Recommendation**: **Restore**. Crucial hotbar bug fix for V14.

#### `GYGAX-022`: Modern User ID Reference in Whispers (`game.user.id`)
* **Status**: `🟡 Planned`
* **Category**: Core Compliance
* **Files**: [`src/module/helpers-dice.js`](src/module/helpers-dice.js), [`src/module/helpers-treasure.js`](src/module/helpers-treasure.js)
* **Origin**: Commit `a27707b1`
* **Description**: Updates legacy `game.user._id` references to modern standard `game.user.id`, eliminating Foundry V14 deprecation warnings.
* **Recommendation**: **Restore**. Clean standards compliance.

#### `GYGAX-023`: Custom Weapon Qualities: Penetrating & Reach
* **Status**: `🟡 Planned`
* **Category**: Equipment & Tags
* **Files**: [`src/module/config.ts`](src/module/config.ts), [`src/lang/en.json`](src/lang/en.json), `assets/penetrating.png`, `assets/reach.png`
* **Origin**: Commits `b898fa8`, `76764c06`
* **Description**: Restores weapon tags `penetrating` (heavy crossbows, armor piercing) and `reach` (polearms, spears) with their custom icons and localization keys.
* **Recommendation**: **Restore**. Needed for Gygax '75 tactical weapon balance.

#### `GYGAX-024`: Gygax '75 Custom Classes for String Mode
* **Status**: `🟡 Planned`
* **Category**: Classes & Rules
* **Files**: [`src/module/classes/gygax75-classes.ts`](src/module/classes/gygax75-classes.ts), [`src/module/config.ts`](src/module/config.ts)
* **Origin**: Commit `b898fa8`
* **Description**: Registers class definitions (Barbarian, Druid, Gnome, Half-Orc, Knight, Warden, Wood Elf) in `CONFIG.OSE.classes` so character level progression (HD, THAC0, Saves) resolves automatically when `enableClassItems: false`.
* **Recommendation**: **Restore**. Essential companion to `GYGAX-001`.

#### `GYGAX-025`: Monster Sheet RollTable Drop Hyperlink Labels
* **Status**: `🟡 Planned`
* **Category**: Monster Sheet
* **Files**: [`src/module/actor/monster-sheet.js`](src/module/actor/monster-sheet.js)
* **Origin**: Commit `6437567`
* **Description**: Resolves `fromUuid()` when dropping a world RollTable onto a monster sheet to generate `@UUID[...]{Table Name}` instead of raw, unlabelled `@UUID[...]`.
* **Recommendation**: **Restore**. Consistent with Foundry adventure ingestion hyperlinking rules.

#### `GYGAX-026`: Monster Sheet Description Editor 100% Height
* **Status**: `🟡 Planned`
* **Category**: Monster Sheet
* **Files**: [`src/scss/monster.scss`](src/scss/monster.scss)
* **Origin**: Commit `40ab62c`
* **Description**: Changes `.sheet-body .editor` from fixed `height: 300px;` to `height: 100%;`, allowing monster ecology and tactical text to expand responsively with window resizing.
* **Recommendation**: **Restore**. Clean UI enhancement.

---

### 🔴 Obsolete Customizations

#### `GYGAX-027`: ApplicationV1 FormApplication Overrides
* **Status**: `🔴 Obsolete`
* **Category**: Legacy Architecture
* **Files**: Historical `src/module/dialog/*.js`
* **Origin**: Commits prior to v3.0
* **Reason for Retirement**: Upstream fully migrated dialogs and sheets to Foundry V12/V14 ApplicationV2 (`HandlebarsApplicationMixin(ApplicationV2)`). Retaining legacy FormApplication overrides causes crashes and deprecation errors.

#### `GYGAX-028`: `template.json` Custom Property Injections
* **Status**: `🔴 Obsolete`
* **Category**: Manifests
* **Files**: `template.json`
* **Origin**: Pre-v3 data model hacks
* **Reason for Retirement**: Dropped by upstream in commit `b114266`. Foundry V13/V14 uses TypeDataModels declared in `system.json` under `documentTypes`. All custom system fields are now formally modeled in TypeScript DataModel classes.

#### `GYGAX-029`: Hardcoded Sheet Window Pixel Dimensions
* **Status**: `🔴 Obsolete`
* **Category**: UI & Sizing
* **Files**: Historical `actor-sheet.js`
* **Origin**: Commit `2d6a23a`
* **Reason for Retirement**: Previously used to prevent sheet collapse in Foundry V10. In ApplicationV2, sheet windows utilize flexible CSS grid and min-content constraints; hardcoded dimensions interfere with responsive window scaling.

#### `GYGAX-030`: Legacy `.wait()` Dialog Pattern
* **Status**: `🔴 Obsolete`
* **Category**: Dialog Architecture
* **Files**: Historical dialog wrappers
* **Origin**: Foundry V11/V12
* **Reason for Retirement**: Deprecated in Foundry V14 in favor of event-driven `DialogV2` constructor pattern with explicit `position` and `classes: ["ose", "dialog"]`.
