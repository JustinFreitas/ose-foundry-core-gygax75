# OSE Gygax '75 System Customizations Registry

This document serves as the authoritative registry of all custom modifications, rule enhancements, and UI tweaks maintained in the `ose-foundry-core-gygax75` fork of the official Old-School Essentials system for Foundry VTT (upstream: [`NecroticGnome/ose-foundry-core`](https://github.com/NecroticGnome/ose-foundry-core)).

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
| `GYGAX-001` | `🟢 Active` | Migration & Data | Setting Gate for Class/Race Items | `src/module/settings.ts`, `src/module/migration/index.ts`, `src/module/migration/convert-actor.ts` |
| `GYGAX-002` | `🟢 Active` | UI & Styling | Gygax '75 High-Res Login Art & Thumbnail | `assets/ose-system.webp`, `assets/ose-system-thumbnail.webp` |
| `GYGAX-003` | `🟢 Active` | UI & Styling | Compact Top-Center Game Pause Indicator | `src/scss/core.scss` |
| `GYGAX-004` | `🟢 Active` | Combat & Initiative | Fast/Slow Initiative Groups & Combat Tracker | `src/module/combat/combat.ts`, `src/module/combat/combatant.ts`, `src/module/combat/combat-tracker.ts` |
| `GYGAX-005` | `🟢 Active` | Encumbrance | BECMI 2,400 cn Encumbrance & Multi-Tier Bar | `src/module/actor/data-model-classes/data-model-character-encumbrance.ts`, `template.json` |
| `GYGAX-006` | `🟢 Active` | Character Creation | Auto Stat Gen & Sub-Par Rerolls | `src/module/dialog/character-creation.js`, `src/templates/actors/partials/character-header.html` |
| `GYGAX-007` | `🟢 Active` | Economy & Shopping | GP (Bank) Ledger & Shopping Cart Flow | `src/module/dialog/character-creation.js`, `src/module/dialog/character-gp-cost.js` |
| `GYGAX-008` | `🟢 Active` | Party Management | Party Sheet Rosters, Duty XP & Retention | `src/module/party/party-sheet.js`, `src/module/party/duty-xp.js`, `src/module/party/party-xp.js`, `src/module/helpers-party.js` |
| `GYGAX-009` | `🟢 Active` | Inventory | Container D&D & Nested Container Prevention | `src/module/sheet/drag-drop.js`, `src/module/sheet/inventory-actions.js`, `src/module/actor/actor-sheet.js` |
| `GYGAX-010` | `🟢 Active` | Rules & Mechanics | DialogV2 Hit Dice Rolling & Name-Level Scaling | `src/module/actor/entity.js`, `src/lang/en.json` |
| `GYGAX-011` | `🟢 Active` | Tactical Combat | Combat Modifiers & Ammunition Tracking | `src/module/actor/entity.js`, `src/module/item/entity.ts`, `src/module/settings.ts` |
| `GYGAX-012` | `🟢 Active` | Tactical Combat | Tactical Combat Hooks (Healing & Speed) | `src/module/combat/tactical-combat-hooks.ts`, `src/ose.js` |
| `GYGAX-013` | `🟢 Active` | Active Effects | Effects Tab & Link Forwarding | `src/module/actor/actor-sheet.js`, `src/templates/actors/partials/actor-effects-tab.html` |
| `GYGAX-014` | `🟢 Active` | UI & Styling | DialogV2 OSE Parchment & Styling Standards | `src/scss/apps.scss`, `src/module/rings.ts`, `src/module/sheet/dialogs.js` |
| `GYGAX-015` | `🟢 Active` | UI & Styling | Window Content Double Scrollbar Fix | `src/scss/core.scss` |
| `GYGAX-016` | `🟢 Active` | UI & Styling | Character Sheet Notes Tab Responsive Flex | `src/scss/character.scss` |
| `GYGAX-017` | `🟢 Active` | UI & Styling | Effects Tab Full-Height Inventory Sizing | `src/scss/actor-base.scss` |
| `GYGAX-018` | `🟢 Active` | UI & Shopping | Shopping Cart Max Height & Currency Alignment | `src/scss/apps.scss` |
| `GYGAX-019` | `🟢 Active` | Economy & Math | Bundle Cumulative Cost & Encumbrance Math | `src/module/item/data-model-item.ts`, `src/module/item/data-model-weapon.ts`, `src/module/item/data-model-armor.ts` |
| `GYGAX-020` | `🟢 Active` | UI & Sheets | Item Sheet (Bundle) Visual Suffix Labels | `src/templates/items/*.html`, `src/lang/*.json` |
| `GYGAX-021` | `🟢 Active` | Macros & Hotbar | Macro Unlinked Token Resolution & Quoted Escaping | `src/module/helpers-macros.js` |
| `GYGAX-022` | `🟢 Active` | Core Compliance | Modern User ID Reference in Whispers (`game.user.id`) | `src/module/helpers-dice.js`, `src/module/helpers-treasure.js` |
| `GYGAX-023` | `🟢 Active` | Equipment & Tags | Custom Weapon Qualities: Penetrating & Reach | `src/module/config.ts`, `src/lang/en.json`, `assets/` |
| `GYGAX-024` | `🟢 Active` | Classes & Rules | Gygax '75 Custom Classes & Migration Indexer | `src/module/classes/gygax75-classes.ts`, `src/module/classes/classic-to-item.ts`, `src/module/migration/class-index.ts` |
| `GYGAX-025` | `🟢 Active` | Monster Sheet | Monster Sheet RollTable Drop Hyperlink Labels | `src/module/actor/monster-sheet.js` |
| `GYGAX-026` | `🟢 Active` | Monster Sheet | Monster Sheet Description Editor 100% Height | `src/scss/monster.scss` |
| `GYGAX-027` | `🔴 Obsolete` | Legacy Architecture | ApplicationV1 FormApplication Overrides | Various pre-v3 JS files |
| `GYGAX-028` | `🔴 Obsolete` | Manifests | Legacy Ad-Hoc `template.json` Field Injections | `template.json` (superseded by `TypeDataModel` schemas) |
| `GYGAX-029` | `🔴 Obsolete` | UI & Sizing | Hardcoded Sheet Window Pixel Dimensions | Legacy sheet constructors |
| `GYGAX-030` | `🔴 Obsolete` | Dialog Architecture | Legacy `.wait()` Dialog Pattern | Pre-ApplicationV2 dialog wrappers |
| `GYGAX-031` | `🟢 Active` | Combat & Ammunition | Magical Ammo Bonuses & Auto-Range Modifiers | `src/module/item/entity.ts`, `src/module/helpers-dice.js`, `src/module/actor/entity.js` |
| `GYGAX-032` | `🟢 Active` | Spellcasting | Spell Slot Schema Levels 1–9 | `template.json`, `src/module/actor/data-model-character.js`, `src/module/effects/effect-keys.ts` |
| `GYGAX-033` | `🟢 Active` | Inventory & Secrets | Unidentified Items & Hidden GM Charges | `src/module/item/data-model-item.ts`, `src/module/item/entity.ts`, `src/module/item/item-sheet.js` |
| `GYGAX-034` | `🟢 Active` | Combat & Weapons | Conditional "Vs. Creature Group" Weapon Modifiers | `src/module/item/data-model-weapon.ts`, `src/module/actor/entity.js` |
| `GYGAX-035` | `🟢 Active` | Abilities | Ability-Linked Roll-Under Proficiencies | `src/module/item/data-model-ability.ts`, `src/module/item/entity.ts`, `src/templates/items/ability-sheet.html` |
| `GYGAX-036` | `🟢 Active` | Monsters & Mounts | Silver/Magic Gating, Damage Mitigation, MR % & Mount Load | `src/module/actor/entity.js`, `src/module/actor/data-model-monster.js`, `src/module/helpers-chat.ts` |
| `GYGAX-037` | `🟢 Active` | Manifests | Intentional Omission of `relationships.recommends` | `system.json` |

---

## Detailed Customization Catalog

### 🟢 Active Customizations

#### `GYGAX-001`: Setting Gate for Discrete Class/Race Items
* **Status**: `🟢 Active`
* **Category**: Migration & Data
* **Files**: [`src/module/settings.ts`](src/module/settings.ts), [`src/module/migration/index.ts`](src/module/migration/index.ts), [`src/module/migration/convert-actor.ts`](src/module/migration/convert-actor.ts), [`src/module/actor/data-model-character.js`](src/module/actor/data-model-character.js), [`src/module/actor/entity.js`](src/module/actor/entity.js), [`src/templates/actors/character-sheet.html`](src/templates/actors/character-sheet.html)
* **Origin**: Commit `59fdbbe` (`v3.1.0-beta.2-gygax75.1`)
* **Description**: Adds the `enableClassItems` world setting (defaulting to `false`). When disabled, character sheets preserve single-string `system.details.class` and `system.details.title`, hide the upstream migration banner/buttons, guard headless conversion/XP/derivation paths against residual `class`/`race` items, and prevent automated data migration from breaking backward compatibility with existing campaign actors and macros.
* **Upstream Merge Guard**: Ensure `enableClassItems` checks remain intact across migration entrypoints, `OseDataModelCharacter`, and `OseActor`.

#### `GYGAX-002`: Gygax '75 High-Res Login Art & World Thumbnail
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`assets/ose-system.webp`](assets/ose-system.webp), [`assets/ose-system-thumbnail.webp`](assets/ose-system-thumbnail.webp)
* **Origin**: Commit `75f2940` (`v3.1.0-beta.2-gygax75.2`)
* **Description**: Replaces the default upstream cover with the custom high-resolution Gygax '75 fantasy dungeon crawler splash art and world banner.
* **Upstream Merge Guard**: Upstream updates regularly overwrite `assets/ose-system.webp` and `assets/ose-system-thumbnail.webp`; restore custom binary assets after pulls.

#### `GYGAX-003`: Compact Top-Center Game Pause Indicator
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`src/scss/core.scss`](src/scss/core.scss)
* **Origin**: Commit `6d62733` (`v3.1.0-beta.2-gygax75.3`)
* **Description**: Restyles Foundry's default `#pause` overlay to a compact 48px badge positioned at the top-center margin (`top: 20px`, `transform: translate(-50%, 0) scale(0.5)`). Retains Foundry V14 click-through safety (`pointer-events: none`).
* **Upstream Merge Guard**: Check `src/scss/core.scss` on upstream pulls.

#### `GYGAX-004`: Fast/Slow Initiative Groups & Combat Tracker Enhancements
* **Status**: `🟢 Active`
* **Category**: Combat & Initiative
* **Files**: [`src/module/combat/combat.ts`](src/module/combat/combat.ts), [`src/module/combat/combatant.ts`](src/module/combat/combatant.ts), [`src/module/combat/combat-tracker.ts`](src/module/combat/combat-tracker.ts), [`src/module/combat/combat-set-groups.ts`](src/module/combat/combat-set-groups.ts), [`src/templates/sidebar/combat-tracker-combatant.hbs`](src/templates/sidebar/combat-tracker-combatant.hbs)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported to v3.0 ApplicationV2 in `e373913`
* **Description**: Streamlines OSE group and individual initiative with one-click side rolling, combatant group selector (`OSECombatGroupSelector`), fast combatant cycling, and dedicated `"fast"` (`789` / `fa-bolt-lightning` — e.g. Halflings acting ahead of rolled initiative groups unless using a `Slow` weapon) and `"slow"` (`-789` — two-handed/slow weapons acting last) initiative brackets.
* **Upstream Merge Guard**: Upstream ApplicationV2 combat tracker and `OSECombat._sortCombatants` updates.

#### `GYGAX-005`: BECMI 2,400 cn Encumbrance Variant & Multi-Tier Bar
* **Status**: `🟢 Active`
* **Category**: Encumbrance
* **Files**: [`src/module/actor/data-model-classes/data-model-character-encumbrance.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance.ts), [`src/module/actor/data-model-classes/data-model-character-move.ts`](src/module/actor/data-model-classes/data-model-character-move.ts), [`src/templates/actors/partials/character-encumbrance.html`](src/templates/actors/partials/character-encumbrance.html), [`src/scss/character.scss`](src/scss/character.scss), [`template.json`](template.json)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Implements the official BECMI/RC maximum load capacity of 2,400 cn (`400 / 800 / 1,200 / 2,400 cn` breakpoints) alongside standard B/X 1,600 cn thresholds via the `gygax75Encumbrance` setting, complete with multi-tier encumbrance bar colors (`tier-1`..`tier-4`) and `untilNextBreakpoint` / `nextBase` speed tooltips.
* **Upstream Merge Guard**: DataModel schema validations and `character-encumbrance.html` rounding helpers.

#### `GYGAX-006`: Auto Stat Generation & Sub-Par Rerolls
* **Status**: `🟢 Active`
* **Category**: Character Creation
* **Files**: [`src/module/dialog/character-creation.js`](src/module/dialog/character-creation.js), [`src/templates/actors/partials/character-header.html`](src/templates/actors/partials/character-header.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Provides automated 3d6 in order, 4d6 drop lowest, and standard array generation with automatic detection of "hopeless" / sub-par characters (highest score $\le 8$ or net negative modifiers) offering instant GM-approved rerolls.
* **Upstream Merge Guard**: Verify header actions on character sheet.

#### `GYGAX-007`: GP (Bank) Ledger & Shopping Cart Flow
* **Status**: `🟢 Active`
* **Category**: Economy & Shopping
* **Files**: [`src/module/dialog/character-creation.js`](src/module/dialog/character-creation.js), [`src/module/dialog/character-gp-cost.js`](src/module/dialog/character-gp-cost.js), [`src/templates/chat/inventory-list.html`](src/templates/chat/inventory-list.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Supports banking and town economy with a discrete `"GP (Bank)"` ledger item that character creation and equipment shopping carts draw from first, automatically falling back to physical `"GP"` with exact `"SP"` / `"CP"` change for fractional purchases.
* **Upstream Merge Guard**: DialogV2 migration touchpoints and non-mutating shopping cart view-models.

#### `GYGAX-008`: Party Sheet Rosters, Duty XP & Retention
* **Status**: `🟢 Active`
* **Category**: Party Management
* **Files**: [`src/module/party/party-sheet.js`](src/module/party/party-sheet.js), [`src/module/party/duty-xp.js`](src/module/party/duty-xp.js), [`src/module/party/party-xp.js`](src/module/party/party-xp.js), [`src/module/helpers-party.js`](src/module/helpers-party.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Enhances party oversight with saved exploration rosters (`savedParties`), `deleteActor` roster cleanup, retainer share deductions (1/2 XP for retainers), and role-based Duty XP bonus toggles.
* **Upstream Merge Guard**: Party sheet templates and XP bonus Active Effect interactions.

#### `GYGAX-009`: Container D&D & Nested Container Prevention
* **Status**: `🟢 Active`
* **Category**: Inventory
* **Files**: [`src/module/sheet/drag-drop.js`](src/module/sheet/drag-drop.js), [`src/module/sheet/inventory-actions.js`](src/module/sheet/inventory-actions.js), [`src/module/actor/actor-sheet.js`](src/module/actor/actor-sheet.js), [`src/module/actor/character-sheet.js`](src/module/actor/character-sheet.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Drag-and-drop item management for backpacks, sacks, and chests with container capacity math, cross-actor drop cleanup, and strict protection against nesting containers inside containers.
* **Upstream Merge Guard**: Actor sheet item drag-and-drop handlers (`src/module/sheet/drag-drop.js`).

#### `GYGAX-010`: DialogV2 Hit Dice Rolling & Name-Level Scaling
* **Status**: `🟢 Active`
* **Category**: Rules & Mechanics
* **Files**: [`src/module/actor/entity.js`](src/module/actor/entity.js), [`src/lang/en.json`](src/lang/en.json)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Interactive `DialogV2` Hit Dice rolling prompt (`OseActor.rollHitDice`) supporting either single-level rolling (`+1 HD`, CON modifier, flat HD bonus preservation, minimum `1` HP gain, and name-level flat HP increments past level 9) or full multi-HD rerolling across all character levels, plus minimum `1` HP clamping on monster `rollHP()`.
* **Upstream Merge Guard**: `DialogV2` classes `["ose", "dialog"]`, explicit `position` dimensions, and Promise return contract.

#### `GYGAX-011`: Tactical Combat Modifiers & Ammunition Tracking
* **Status**: `🟢 Active`
* **Category**: Tactical Combat
* **Files**: [`src/module/actor/entity.js`](src/module/actor/entity.js), [`src/module/item/entity.ts`](src/module/item/entity.ts), [`src/module/settings.ts`](src/module/settings.ts), [`src/templates/chat/roll-dialog.html`](src/templates/chat/roll-dialog.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Interactive roll dialog situational modifiers and configurable missile/thrown weapon ammunition tracking (`automateAmmo`: `"disabled"`, `"warn"`, `"enforce"`) in `OseItem._handleAmmoConsumption`, automatically deducting linked quiver ammunition or thrown weapon quantities on attack confirmation.
* **Upstream Merge Guard**: Attack roll execution methods in `src/module/actor/entity.js` and `src/module/item/entity.ts`.

#### `GYGAX-012`: Tactical Combat Hooks (Healing & Speed)
* **Status**: `🟢 Active`
* **Category**: Tactical Combat
* **Files**: [`src/module/combat/tactical-combat-hooks.ts`](src/module/combat/tactical-combat-hooks.ts), [`src/ose.js`](src/ose.js)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Registers Foundry hooks (`preUpdateActor` and `preCreateChatMessage`) that post a chat warning when healing an actor afflicted by active Poison or Disease effects (excluding level-up max-HP increases) and append an `"⚡ Extra Attack"` speed banner on attack roll cards for actors with active Haste / Potion of Speed effects.
* **Upstream Merge Guard**: System initialization hooks in `src/ose.js`.

#### `GYGAX-013`: Active Effects Tab & Link Forwarding
* **Status**: `🟢 Active`
* **Category**: Active Effects
* **Files**: [`src/module/actor/actor-sheet.js`](src/module/actor/actor-sheet.js), [`src/templates/actors/partials/actor-effects-tab.html`](src/templates/actors/partials/actor-effects-tab.html)
* **Origin**: Pre-v3 (`2.3.0-gygax75`), ported in `e373913`
* **Description**: Embedded Active Effects management tab on character and monster sheets with link forwarding to originating spells, items, or conditions and suppression of Active Effects on unequipped gear.
* **Upstream Merge Guard**: Actor sheet template tab registration (`character-sheet.js` and `monster-sheet.js`).

#### `GYGAX-014`: DialogV2 Styling Standards (Parchment & Denim)
* **Status**: `🟢 Active`
* **Category**: UI & Styling
* **Files**: [`src/scss/apps.scss`](src/scss/apps.scss), [`src/module/rings.ts`](src/module/rings.ts), [`src/module/sheet/dialogs.js`](src/module/sheet/dialogs.js), [`src/module/sheet/inventory-actions.js`](src/module/sheet/inventory-actions.js), [`src/module/dialog/entity-tweaks.js`](src/module/dialog/entity-tweaks.js)
* **Origin**: Standardized in `b898fa8`, ported in `e373913`
* **Description**: Custom parchment backgrounds, dark borders, and legible typography applied to all `DialogV2` windows using classes `["ose", "dialog"]`, explicit `position` dimensions, and `rejectClose: false` confirmation prompts.
* **Upstream Merge Guard**: Upstream `DialogV2` additions and SCSS overrides.

---

### 🟢 Active Customizations (Restored & Expanded in v3.1–v3.2)

#### `GYGAX-015`: Window Content Double Scrollbar Fix
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: UI & Styling
* **Files**: [`src/scss/core.scss`](src/scss/core.scss)
* **Origin**: Commit `915db54`
* **Description**: Adds `.ose .window-content { overflow: hidden; }`. In Foundry V14 ApplicationV2 sheets, inner tabs handle their own scrolling; omitting `overflow: hidden` on `.window-content` produces annoying dual scrollbars.

#### `GYGAX-016`: Character Sheet Notes Tab Responsive Flex
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: UI & Styling
* **Files**: [`src/scss/character.scss`](src/scss/character.scss)
* **Origin**: Commit `02911faddebb`
* **Description**: Replaces upstream's rigid `min-height: 500px; overflow-y: visible;` with a responsive flex container (`height: 100%; flex: 1 1 0; min-height: 0;`), allowing the character notes editor to scale seamlessly when the window is resized.

#### `GYGAX-017`: Effects Tab Full-Height Inventory Sizing
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: UI & Styling
* **Files**: [`src/scss/actor-base.scss`](src/scss/actor-base.scss)
* **Origin**: Commit `02911faddebb`
* **Description**: Adds `&.effects, &.effects-list { height: 100%; }` to `.inventory` in `actor-base.scss`. Ensures the active effects list expands to fill the entire sheet body height rather than collapsing to minimal content height.

#### `GYGAX-018`: Shopping Cart Max Height & Currency Alignment
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: UI & Shopping
* **Files**: [`src/scss/apps.scss`](src/scss/apps.scss)
* **Origin**: Commits `33de686`, `2b45489`
* **Description**: Enforces `max-height: 450px; overflow-y: auto;` on `.ose.gp-cost .item-list` and sets right-aligned numeric alignment for currency columns, preventing long equipment lists from expanding off-screen.

#### `GYGAX-019`: Bundle Cumulative Cost & Encumbrance Math Model
* **Status**: `🟢 Active` (Enhanced in `v3.1.0-beta.2-gygax75.6` & `v3.2.0-gygax75`)
* **Category**: Economy & Math
* **Files**: [`src/module/item/data-model-item.ts`](src/module/item/data-model-item.ts), [`src/module/item/data-model-weapon.ts`](src/module/item/data-model-weapon.ts), [`src/module/item/data-model-armor.ts`](src/module/item/data-model-armor.ts), [`src/module/item/data-model-container.ts`](src/module/item/data-model-container.ts), [`src/module/actor/data-model-classes/data-model-character-encumbrance-basic.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance-basic.ts), [`src/module/actor/data-model-classes/data-model-character-encumbrance-complete.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance-complete.ts), [`src/module/actor/data-model-classes/data-model-character-encumbrance-detailed.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance-detailed.ts), [`src/module/actor/data-model-classes/data-model-character-encumbrance-item-based.ts`](src/module/actor/data-model-classes/data-model-character-encumbrance-item-based.ts)
* **Origin**: Commit `68f245d1`, expanded in `3.1.0-beta.2-gygax75.6`
* **Description**: Calculates item value, weight, and slots proportionally as `(value / quantity.max) * quantity.value` when `quantity.max > 0` across items, weapons, armor, and containers. Connected to actor encumbrance reducers across Basic, Complete, Detailed, and Item-Based encumbrance variants so partial bundles (such as 15 remaining arrows in a 20-arrow quiver) calculate exact fractional weight and slot load.

#### `GYGAX-020`: Item Sheet Localized (Bundle) Visual Suffix Labels
* **Status**: `🟢 Active` (Localized in `v3.1.0-beta.2-gygax75.6`)
* **Category**: UI & Sheets
* **Files**: [`src/templates/items/*.html`](src/templates/items/), [`src/lang/*.json`](src/lang/)
* **Origin**: Commits `68f245d1`, `d4ed2e00`, localized across all 12 supported system languages in `3.1.0-beta.2-gygax75.6`
* **Description**: Displays localized bundle suffix (`OSE.items.BundleSuffix`) in cost and weight labels across all item sheets (`item-sheet`, `armor-sheet`, `container-sheet`, `weapon-sheet`) whenever `system.quantity.max > 0`, clarifying that listed prices and weights represent the whole package without hardcoding English text.

#### `GYGAX-021`: Macro Unlinked Token Resolution & Quoted Escaping
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: Macros & Hotbar
* **Files**: [`src/module/helpers-macros.js`](src/module/helpers-macros.js)
* **Origin**: Commit `a27707b1`
* **Description**: Replaces deprecated `game.actors.tokens[speaker.token]` (broken in V12+) with `scene.tokens.get(speaker.token)?.actor` for synthetic tokens, resolves V14 `{ uuid }` hotbar drop payloads via `fromUuid()`, and wraps macro command generation in `JSON.stringify()` to prevent syntax errors when rolling items with apostrophes (e.g. *Ogre's Club*).

#### `GYGAX-022`: Modern User ID Reference in Whispers (`game.user.id`)
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: Core Compliance
* **Files**: [`src/module/helpers-dice.js`](src/module/helpers-dice.js), [`src/module/helpers-treasure.js`](src/module/helpers-treasure.js)
* **Origin**: Commit `a27707b1`
* **Description**: Updates legacy `game.user._id` references to modern standard `game.user.id`, eliminating Foundry V14 deprecation warnings.

#### `GYGAX-023`: Custom Weapon Qualities: Penetrating & Reach
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: Equipment & Tags
* **Files**: [`src/module/config.ts`](src/module/config.ts), [`src/lang/en.json`](src/lang/en.json), [`assets/penetrating.png`](assets/penetrating.png), [`assets/reach.png`](assets/reach.png)
* **Origin**: Commits `b898fa8`, `76764c06`
* **Description**: Restores weapon tags `penetrating` (heavy crossbows, armor piercing) and `reach` (polearms, spears) with their custom icons and localization keys.

#### `GYGAX-024`: Gygax '75 Custom Classes & Migration Indexer
* **Status**: `🟢 Active` (Enhanced in `v3.1.0-beta.2-gygax75.6` & `v3.2.0-gygax75`)
* **Category**: Classes & Rules
* **Files**: [`src/module/classes/gygax75-classes.ts`](src/module/classes/gygax75-classes.ts), [`src/module/classes/classic-to-item.ts`](src/module/classes/classic-to-item.ts), [`src/module/config.ts`](src/module/config.ts), [`src/module/migration/class-index.ts`](src/module/migration/class-index.ts)
* **Origin**: Commit `b898fa8`, expanded in `3.1.0-beta.2-gygax75.6`
* **Description**: Defines the canonical Gygax '75 Basic Rulebook classes (`Barbarian`, `Druid`, `Gnome`, `Half-Orc`, `Knight`, `Warden`, `Wood Elf`) in `CONFIG.OSE.classes.gygax75` with complete XP, HD, THAC0, saving throw, spell slot, prime requisite, `demihuman`, and `spellList` (`"Druid"`, `"Illusionist"`) tables. `buildClassIndex()` and `classicClassToItemData()` index both `classic` and `gygax75` class definitions for seamless Class Item conversion when `enableClassItems` is enabled (while preserving free-text class strings when `enableClassItems: false`).

#### `GYGAX-025`: Monster Sheet RollTable Drop Hyperlink Labels
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: Monster Sheet
* **Files**: [`src/module/actor/monster-sheet.js`](src/module/actor/monster-sheet.js)
* **Origin**: Commit `6437567`
* **Description**: Resolves `fromUuid()` when dropping a world RollTable onto a monster sheet to generate `@UUID[...]{Table Name}` instead of raw, unlabelled `@UUID[...]`.

#### `GYGAX-026`: Monster Sheet Description Editor 100% Height
* **Status**: `🟢 Active` (Restored in `v3.1.0-beta.2-gygax75.4`)
* **Category**: Monster Sheet
* **Files**: [`src/scss/monster.scss`](src/scss/monster.scss)
* **Origin**: Commit `40ab62c`
* **Description**: Changes `.sheet-body .editor` from fixed `height: 300px;` to `height: 100%;`, allowing monster ecology and tactical text to expand responsively with window resizing.

#### `GYGAX-031`: Magical Ammunition Bonus Application & Auto-Range Band Modifiers
* **Status**: `🟢 Active`
* **Category**: Combat & Ammunition
* **Files**: [`src/module/item/entity.ts`](src/module/item/entity.ts), [`src/module/helpers-dice.js`](src/module/helpers-dice.js), [`src/module/actor/entity.js`](src/module/actor/entity.js)
* **Description**: Extracts magical ammunition bonuses (`+1`, `+2`, `-1`, or `system.bonus`) in `OseItem.extractAmmoBonus()` and injects them into attack and damage rolls via `options.onConfirm(form, rollData)` in `OseDice.Roll` when ammunition is available. Also adds `OseActor.computeRangeModifier()` and automatic canvas token distance measurement to apply B/X missile range modifiers (`+1` Short, `0` Medium, `-1` Long, and out-of-range warning).

#### `GYGAX-032`: Spell Slot Schema Levels 1–9
* **Status**: `🟢 Active`
* **Category**: Spellcasting & Progression
* **Files**: [`template.json`](template.json), [`src/module/actor/data-model-character.js`](src/module/actor/data-model-character.js), [`src/module/actor/entity.js`](src/module/actor/entity.js), [`src/module/effects/effect-keys.ts`](src/module/effects/effect-keys.ts), [`src/module/item/item-sheet.js`](src/module/item/item-sheet.js)
* **Description**: Expands spell slot schemas, class derivation, Active Effect keys, and spell item level selectors from levels `1–6` to `1–9` so high-level B/X & OSE modules (such as *I3–5 Desert of Desolation* NPC archmages and scrolls) work natively.

#### `GYGAX-033`: Unidentified Items & Hidden GM Charges
* **Status**: `🟢 Active`
* **Category**: Inventory & Exploration
* **Files**: [`src/module/item/data-model-item.ts`](src/module/item/data-model-item.ts), [`src/module/item/data-model-weapon.ts`](src/module/item/data-model-weapon.ts), [`src/module/item/data-model-armor.ts`](src/module/item/data-model-armor.ts), [`src/module/item/entity.ts`](src/module/item/entity.ts), [`src/module/item/item-sheet.js`](src/module/item/item-sheet.js), [`src/templates/actors/partials/character-inventory-tab.html`](src/templates/actors/partials/character-inventory-tab.html)
* **Description**: Adds `identified`, `unidentifiedName`, `unidentifiedDescription`, and `hideCounter` fields to items, weapons, and armor. Non-GM players see the masked name/description, have secret stats/tags/costs concealed on item sheets and chat cards, and have charge counters hidden on wands/staves when `hideCounter` is enabled, while GMs retain full visibility.

#### `GYGAX-034`: Conditional "Vs. Creature Group" Weapon Modifiers
* **Status**: `🟢 Active`
* **Category**: Combat & Magic Weapons
* **Files**: [`src/module/item/data-model-weapon.ts`](src/module/item/data-model-weapon.ts), [`src/module/actor/entity.js`](src/module/actor/entity.js)
* **Description**: Parses conditional weapon bonuses from manual tags (`+3 vs. undead`, `+2 vs dragons`, `+3 vs regenerating`) or `system.vsGroup` and automatically substitutes the higher conditional bonus on attack and damage rolls when targeting a matching creature group (evaluated with HTML-stripped word-boundary matching).

#### `GYGAX-035`: Ability-Linked Roll-Under Proficiencies (`1d20 <= Ability Score ± Mod`)
* **Status**: `🟢 Active`
* **Category**: Abilities & Proficiencies
* **Files**: [`src/module/item/data-model-ability.ts`](src/module/item/data-model-ability.ts), [`src/module/item/entity.ts`](src/module/item/entity.ts), [`src/module/item/item-sheet.js`](src/module/item/item-sheet.js), [`src/templates/items/ability-sheet.html`](src/templates/items/ability-sheet.html)
* **Description**: Adds `abilityScore` and `targetMod` fields to Ability items so optional roll-under proficiencies resolve dynamically against the owning character's ability score (`1d20 <= scores[abilityScore].value + targetMod`) with situational modifier dialog support.

#### `GYGAX-036`: Silver/Magic Weapon Gating, Damage Mitigation, MR %, & Mount Encumbrance
* **Status**: `🟢 Active`
* **Category**: Monsters & Retainers/Mounts
* **Files**: [`src/module/actor/entity.js`](src/module/actor/entity.js), [`src/module/actor/data-model-monster.js`](src/module/actor/data-model-monster.js), [`src/module/helpers-chat.ts`](src/module/helpers-chat.ts), [`src/templates/chat/roll-attack.html`](src/templates/chat/roll-attack.html), [`src/templates/actors/dialogs/tweaks-dialog.html`](src/templates/actors/dialogs/tweaks-dialog.html)
* **Description**: Adds `OseActor.evaluateWeaponDamage()` and `applyDamage()` options (wired directly into chat card damage buttons in `helpers-chat.ts`) for silver/magic weapon immunity gating, `immuneTo`, and `halfDamageFrom` resistances; adds `OseActor.rollMagicResistance()` (`1d100 <= mr%`); exposes monster immunity/resistance/encumbrance fields in Tweaks; and enables carried weight + half-speed/overloaded movement breakpoints on Monster actors when `encumbrance.max > 0` for mounts and pack animals.

#### `GYGAX-037`: Intentional Omission of `relationships.recommends` Module Prompts
* **Status**: `🟢 Active`
* **Category**: Manifests
* **Files**: [`system.json`](system.json)
* **Origin**: Commit `706d976` (`Remove the recommended modules section from the manifest to avoid the installation dialogs on update`)
* **Description**: Intentionally maintains `"relationships": {}` in `system.json`, omitting upstream's `relationships.recommends` entries (`ose-advancedfantasytome` and `classicfantasycompendium`) so Foundry VTT does not pop up recommended-module installation prompts every time a new `ose-foundry-core-gygax75` release is installed or updated.
* **Upstream Merge Guard**: Keep `"relationships": {}` in `system.json` when merging upstream manifest updates.

---

### 🔴 Obsolete Customizations

#### `GYGAX-027`: ApplicationV1 FormApplication Overrides
* **Status**: `🔴 Obsolete`
* **Category**: Legacy Architecture
* **Files**: Historical `src/module/dialog/*.js`
* **Origin**: Commits prior to v3.0
* **Reason for Retirement**: Upstream fully migrated dialogs and sheets to Foundry V12/V14 ApplicationV2 (`HandlebarsApplicationMixin(ApplicationV2)`). Retaining legacy FormApplication overrides causes crashes and deprecation errors.

#### `GYGAX-028`: Legacy Ad-Hoc `template.json` Property Injections
* **Status**: `🔴 Obsolete`
* **Category**: Manifests
* **Files**: [`template.json`](template.json)
* **Origin**: Pre-v3 data model hacks
* **Reason for Retirement**: In v3+, Foundry V13/V14 `TypeDataModel` classes (`OseDataModel*`) registered in `system.json` under `documentTypes` serve as the authoritative runtime schema, superseding pre-v3 ad-hoc property injections in `template.json`. Note that [`template.json`](template.json) itself is still retained in the repository and packaged in release archives for baseline Foundry template compatibility (aligned with `GYGAX-005` `encumbrance.max: 2400` and `GYGAX-032` spell slots `0–9`).

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

---

## Release Log: `3.1.0-beta.2-gygax75.7`
* **Upstream Synchronization**: Merged 12 upstream commits from `NecroticGnome/ose-foundry-core:main`:
  - **PR #200 (Blair McMillan)**: Switched combat tracker to `this.viewed`, implemented bulk combatant reset (`updateEmbeddedDocuments`) for high-performance combat state clearing, and re-sequenced turn events via `#onNewRound()` before Core turn assignment.
  - **PR #199 (Blair McMillan)**: Guarded ProseMirror form submissions on deleted documents in `actor-sheet.js` and `item-sheet.js`.
  - **PR #198 & #193 (Blair McMillan & Tim Sandberg)**: Applied item-based STR modifier consistently against `packedLoad` and evaluated dual-threshold encumbrance checks.
  - **PR #197 & #195 (Blair McMillan)**: Added monster sheet treasure summary dropdown flyout and synchronous drag event data resolution.
* **Gygax '75 Conflict Resolution**: Preserved all Gygax '75 house rules, including BECMI encumbrance caps (2,400 cn), fast/slow initiative group sorting (`isFast`), and enriched Foundry test stubs.
* **Verification**: 100% test coverage passing (546 / 546 vitest tests, Biome lint/formatting clean, Rollup/SASS distribution built cleanly).

---

## Release Log: `3.1.0-beta.2-gygax75.8`
* **B/X & Module Play Enhancements (`GYGAX-031` – `GYGAX-036`)**:
  - **`GYGAX-031`**: Magical ammunition bonus extraction (`OseItem.extractAmmoBonus`) and automatic injection into attack and damage rolls via `options.onConfirm(form, rollData)`; automated B/X missile range band modifiers (`OseActor.computeRangeModifier`: `+1` Short, `0` Medium, `-1` Long, and out-of-range warning).
  - **`GYGAX-032`**: Expanded spell slot schemas, class derivation, Active Effect keys, and spell item level selectors from levels `1–6` to `1–9` for high-level NPC casters and scrolls.
  - **`GYGAX-033`**: Added `identified`, `unidentifiedName`, `unidentifiedDescription`, and `hideCounter` fields on items, weapons, and armor, masking unidentified names/descriptions and wand/staff charge pips for non-GM players while retaining full GM controls.
  - **`GYGAX-034`**: Conditional `"vs. Creature Group"` weapon modifiers (`OseDataModelWeapon.parsedVsGroups`, `OseActor.matchesCreatureGroup`, `OseActor.resolveWeaponBonus`) supporting both manual tags (`+3 vs. undead`, `+2 vs dragons`, `+3 vs regenerating`) and `system.vsGroup`.
  - **`GYGAX-035`**: Ability-linked roll-under proficiencies (`OseDataModelAbility`: `abilityScore` + `targetMod` -> `1d20 <= scores[abilityScore].value + targetMod`) with situational modifier dialog support.
  - **`GYGAX-036`**: Monster silver/magic weapon immunity gating and damage mitigation (`OseActor.evaluateWeaponDamage`, enhanced `applyDamage`), percentile Magic Resistance rolls (`OseActor.rollMagicResistance`), and mount/pack-animal encumbrance & movement breakpoints (`OseDataModelMonster` when `encumbrance.max > 0`).
* **Manifest Fix**: Restored `"class": { "htmlFields": ["description"] }` and `"race": { "htmlFields": ["description"] }` in `system.json` `documentTypes.Item`.
* **Verification**: 100% test coverage passing (559 / 559 vitest tests across 44 test suites, Biome lint/formatting clean, Rollup/SASS distribution built cleanly).

---

## Release Log: `3.1.0-beta.3-gygax75.1`
* **Upstream Synchronization (`v3.1.0-beta.3` + post-release `main`)**: Merged 21 upstream commits from `NecroticGnome/ose-foundry-core:main` (`1a9b485..f293f0d`):
  - **PR #203 & #204 (Blair McMillan)**: Added player-rollable group initiative buttons (`rollGroup`), right-click manual group initiative prompt (`#promptGroupInitiative`), consolidated single chat card for group initiative rolls (`OSECombat.rollGroupInitiative`), whole-group rolling from combatant initiative clicks, and debounced combat tracker group updates (`#renderTracker`).
  - **PR #201 (Blair McMillan)**: Separated equipped (`system.encumbrance.max`) and packed (`system.encumbrance.packedMax`) item-based encumbrance tweaks and Active Effect keys (`EncumbranceItemBased.caps`).
  - **PR #205 & #207 (Tim Sandberg)**: Extracted `actor.addClass()` and `actor.setRace()` headless APIs, exposed class derivation/progression/conversion helpers on `game.ose`, and structured class requirements (`min`/`max` bounds), `classAccess` (`npcOnly`), infravision, and racial save bonuses (`saveBonuses` fixed or scaled by CON) on class and race items.
* **Gygax '75 Conflict Resolution & Harmonization**:
  - Preserved BECMI 2,400 cn and B/X 1,600 cn default max recognition in `EncumbranceItemBased.caps(max, packedMax)` alongside `cumulativeItemslots` bundle math (`GYGAX-005`, `GYGAX-019`).
  - Preserved `fast` group rendering (`fa-bolt-lightning`) and excluded `"fast"` alongside `"slow"` from `rollGroupInitiative`, `rollInitiative`, `#warnUnrolled`, and the group header right-click manual initiative prompt (`GYGAX-004`).
  - Enforced Foundry V14 `DialogV2` styling (`classes: ["ose", "dialog"]` and explicit `position` dimensions) across `#promptGroupInitiative`, `offerAbilities`, and `onDropRace` (`GYGAX-014`).
  - Preserved `enableClassItems` setting gate in `OseDataModelCharacter.prepareBaseData()`, `onDropClass`, and `onDropRace` (`GYGAX-001`), spell levels `1–9` (`GYGAX-032`), and all B/X & module enhancements (`GYGAX-031`–`GYGAX-036`).
* **Verification**: 100% test coverage passing (603 / 603 vitest tests across 47 test suites, Biome lint/formatting clean, Rollup/SASS distribution built cleanly).

---

## Release Log: `3.2.0-gygax75.1`
* **Upstream Synchronization (`v3.2.0` Official Stable Release)**: Merged upstream tag `3.2.0` (`dea95fb`) from `NecroticGnome/ose-foundry-core:main`:
  - **PR #208 (Blair McMillan)**: Added `@ose-foundry-core/types` automated CI publishing workflow (`publish-types.yml`), type declaration drift check in `test.yml`, and `noCheck: true` in `tsconfig.types.json`.
  - Guarded `.github/workflows/publish-types.yml` with `github.repository == 'NecroticGnome/ose-foundry-core'` so fork releases on `JustinFreitas/ose-foundry-core-gygax75` cleanly skip upstream npm OIDC publishing.
* **Dependency & Security Hardening**:
  - Updated devDependencies (`rollup` `4.68.0`, `sass` `1.108.1`, `vitest` `5.1.0`, `@rollup/plugin-typescript` `12.3.1`, `rollup-plugin-dts` `6.5.1`, `tslib` `2.9.1`, `yargs` `17.7.3`, `@types/livereload` `0.9.5`) and ran `npm audit fix`, remediating 20 transitive advisories (including `handlebars`, `rollup`, `vite`, `@vitest/mocker`, `ws`, `engine.io`, `socket.io-parser`, `picomatch`, `minimatch`, `brace-expansion`, `shell-quote`, `immutable`, `prosemirror-view`, `qs`, `source-map-js`, and `deepmerge`).
* **Verification**: 100% test coverage passing (603 / 603 vitest tests across 47 test suites, Biome lint/formatting clean, Rollup/SASS and TypeScript declaration builds clean).

---

## Release Log: `3.2.0-gygax75.2`
* **Comprehensive Swarm Audit & Remediation (`GYGAX-001`–`GYGAX-037`)**:
  - **Economy & Shopping Cart (`GYGAX-007`, `GYGAX-018`, `GYGAX-019`)**: Replaced in-place `item.system.cost` mutations with non-mutating cart view-models (`OseCharacterGpCost`), included unpaid items stowed inside paid containers, omitted currency/treasure items from purchase receipts, forced `system.treasure = true` on world `"GP (Bank)"` copies, preserved `null` weapon quantities in `_preCreate`/`_preUpdate`, and added exact `"SP"` / `"CP"` coin change when purchasing fractional-cost gear with physical `"GP"`.
  - **Classes, Migration & `enableClassItems` Gate (`GYGAX-001`, `GYGAX-024`)**: Aligned all 7 Gygax '75 classes (`Barbarian`, `Druid`, `Gnome`, `Half-Orc`, `Knight`, `Warden`, `Wood Elf`) to canonical `gygax75_rules.md` progression tables, added `"Druid"` & `"Illusionist"` spell lists, fixed `CONFIG.OSE.tag_images.missile`, replaced `DialogV2.wait` with V14 `DialogV2`, and enforced `enableClassItems` guards across character derivation, actor methods, and headless migration paths.
  - **Combat, Initiative & `GYGAX-036` Chat Damage (`GYGAX-004`, `GYGAX-010`–`GYGAX-012`, `GYGAX-031`, `GYGAX-034`, `GYGAX-036`)**: Wired chat card damage buttons (`helpers-chat.ts`) to resolve attacker token/actor, weapon, and ammo into `targetActor.applyDamage(..., { weapon, ammo })`; hardened combat tracker initiative sorting for unrolled/defeated/fast/slow combatants without `NaN`; refined creature-group word-boundary matching (`matchesCreatureGroup`); prevented empty-quiver magic ammo bonuses and saving-throw `"⚡ Extra Attack"` false positives; and added melee/missile damage bonus Active Effect keys (`system.damage.mod.melee`, `system.damage.mod.missile`).
  - **Encumbrance, Unidentified Items, Containers & Active Effects (`GYGAX-005`, `GYGAX-009`, `GYGAX-013`, `GYGAX-033`)**: Preserved Active Effect movement deltas under `movementAuto` (`encounter = Math.floor(base / 3)`), counted legacy/mount armor with `quantity.value === 0` (e.g. Horse Barding `600 cn`) as `1`, shadowed prototype getter-only `ActiveEffect#isSuppressed` safely via `Object.defineProperty`, masked unidentified item details/effects/counters for non-GM players, deduplicated actor sheet `effects` tabs, and fixed cross-actor container drag-and-drop child cloning.
  - **Tooling, Manifests & CI Hardening (`GYGAX-014`, `GYGAX-037`)**: Normalized repository text files to LF (`.gitattributes`), added strict `tsconfig.ci.json` (`npm run typecheck:ci`) to `lint.yml`, upgraded GitHub Actions workflows to `checkout@v6` / `setup-node@v6` (Node 24) with guarded upstream types-drift checks and `node -e` release manifest injection, standardized all `DialogV2` prompts, and documented `GYGAX-037`.
* **Verification**: 100% test coverage passing (652 / 652 vitest tests across 47 test suites, 0 Biome 2.4.4 lint/format warnings or errors, `npm run typecheck:ci` exit 0, and Rollup/SASS + TypeScript declaration builds clean).

---

## Release Log: `3.3.0-gygax75.1`
* **Upstream Synchronization (`v3.3.0` Official Release — PR #209)**:
  - Merged `NecroticGnome/ose-foundry-core` `v3.3.0` (`870120f` / `f4fd7c5`: melee and missile damage bonuses for Active Effects and Tweaks).
  - Adopted typed `SchemaField` definitions for `system.damage.mod.{melee,missile}` on character and monster data models, `template.json` defaults, `OSE.MeleeDamageBonus` / `OSE.MissileDamageBonus` localization keys, and Tweaks dialog UI fields (`meleeDamage`, `missileDamage`).
  - Reconciled `OseActor.rollAttack()` and `OseActor.rollDamage()` so `system.damage.mod.{melee,missile}` bonuses apply once to both attack-card damage and standalone damage rolls without double-dipping.
* **Foundry V14 Compatibility, Security & Gameplay Fixes**:
  - **Chat Speaker & Unidentified Item Security (`GYGAX-033`)**: Standardized `OseItem.show()` and `OseItem.rollFormula()` to use `ChatMessage.getSpeaker({ actor: this.actor })`, fixing V14 `ChatSpeakerData` `DocumentIdField` validation crashes when posting items from unlinked token actors and preventing secret unidentified item names/tags from leaking to non-GM players (`getVisibleAutoTags()`).
  - **Cross-Actor Container Transfers**: Fixed `drag-drop.js` to compare `actor.uuid` (supporting unlinked synthetic token transfers) and delete stowed child items alongside their parent container on the source actor instead of unstowing and duplicating them.
  - **Synchronous Party Sheet Canvas Dragging**: Converted `OsePartySheet._onDragStart()` to resolve actors synchronously via `fromUuidSync`, keeping HTML5 `event.dataTransfer.setData()` active during Chromium/Electron `dragstart` dispatch.
  - **Chat Card Actions, Spells, Loyalty & Armor AC**: Protected `OseItem._onChatCardAction()` button state with `try/finally`, wired chat card `damage` actions to `actor.rollDamage()`, forwarded roll options (`skipDialog`, `event`) through `OseItem.spendSpell()` and `OseActorSheetCharacter._onRollAbilityScore()` (`rollLoyalty({ event })`), and selected the best AC across multiple equipped non-shield armor items (`OseDataModelCharacterAC`).
  - **UI Idempotency, `ApplicationV2` & Item Piles Integration**: Made `RenderItemDirectory`, `RenderCompendium`, `augmentTable`, `augmentEffectConfig`, and `addControl` idempotent/null-safe; added `"dialog"` styling class and `ui.combat.viewed` priority to `OSECombatGroupSelector`; refreshed the Party Sheet after resetting Duty XP; gated `OseEntityTweaks` `hasClasses` on `enableClassItems` (`GYGAX-001`); and updated `fvttModuleAPIs.js` with `"spell,ability,class,race"` filters and all 5 standard OSE coin denominations (`PP`, `GP`, `EP`, `SP`, `CP`) at `weight: 1` cn.
* **Verification**: 100% test coverage passing (667 / 667 vitest tests across 48 test suites, 0 Biome 2.4.4 lint/format warnings or errors, `npm run typecheck:ci` exit 0, and Rollup/SASS + TypeScript declaration builds clean).
