# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FruitCrash / 果连萌 is a match/link puzzle game built with **Cocos Creator 3.8.0** (project version 3.3.2, migrated from 2.x). Players link matching fruits on an 8x8 grid to complete level objectives. Targets WeChat Mini Games and web platforms. The game is a **pure client-side offline game** — server config and network request methods exist but are unused stubs.

### Migration Caveats (2.x → 3.x)

Be aware when touching animation, prefab, or property-related code:
- `@property` decorators require explicit type annotations (e.g., `@property(Node)`) to appear in the Cocos editor — bare `@property` won't show in the inspector
- Animation parameters may have been lost during migration (scale, opacity, spriteFrame keyframes)
- `action` API was replaced by `tween`; `rotation` → `eulerAngle` (Vec3), `Scale` → `scale` (Vec3)
- Particle directions may differ from 2.x behavior (3D euler angles reverse sign vs 2D rotate)
- LabelAtlas (艺术数字) may error on different machines — regenerate in editor if this happens
- Vec2 coordinates may have `z: undefined` at runtime — use Vec3 or guard z-axis

## Build & Run

This is a Cocos Creator project — open it in the **Cocos Creator** editor. There is no npm/CLI build system; building and previewing are done through the editor's built-in tools. `tsconfig.json` extends auto-generated `temp/tsconfig.cocos.json` with no custom overrides. Design resolution is 720x1280 (portrait).

## Architecture

### Scene Flow
`login` → `pve` (level select) → `fight` (gameplay). Scene transitions managed by `SceneManager`.

### Framework Layer (`assets/scripts/frameworks/`)
Singleton-based services — all use `ClassName.instance` pattern:

| Service | Purpose |
|---------|---------|
| **playerData** | Player state, level progress, inventory. Persisted via `Configuration` (localStorage on web, `jsb.fileUtils` on native). Data keyed by userId. |
| **GameLogic** | Top-level game flow: login, sign-in checks, online rewards, level completion. Ad/share methods are empty stubs. |
| **uiManager** | Dialog lifecycle (show/hide/popup queue). Panels loaded by path string matching prefab name to script name. |
| **clientEvent** | Custom event bus (`on`/`off`/`dispatchEvent`). Core game events: `levelFinished`, `gameOver`, `newLevel`, `useProp`. UI update events: `updateStep`, `updateScore`, `updateGold`, `updateDiamond`, `updateTargets`, `updateProp`. |
| **CSVManager** | Parses CSV tables from `assets/resources/datas/`. CSV format: row 1 = comments, row 2 = types, row 3 = field names, row 4+ = data. Query via `getTable()`, `queryByID()`, `queryOne()`, `queryAll()`. |
| **resourceUtil** | Asset loading helpers. `setCakeIcon(cakeName, sprite, cb)` and `setPropIcon(propId, sprite, cb)` for game icons. |
| **poolManager** | Node object pooling for cakes, lines, effects (reduces GC during rapid linking). |
| **audioManager** | Music/SFX playback via file name. |
| **effectManager** | Visual effects (link lines, explosions, stars). |
| **storageManager** | Low-level persistence. Storage keys defined in `constant.LOCAL_CACHE`: `player`, `history`, `settings`, `bag`, `dataVersion`. |

### Core Gameplay (`assets/scripts/ui/fight/`)

| File | Role |
|------|------|
| **fightScene.ts** | Master controller — coordinates level flow, win/loss, ad revive |
| **linkContent.ts** | Grid board (8x8), touch input, link detection, cake matching |
| **linkItem.ts** | Individual cake sprite — animations, scoring (base: 10pts/cake; bonuses: 1000/line, 2000/plus, 3000/center) |
| **fightUI.ts** | HUD — step counter, score, progress bar, targets, props |
| **fightProp.ts** / **fightPropsOperation.ts** | Prop UI buttons and activation logic |

**Grid mechanics:**
- Grid index = `col + row * 8` (row-major). Convert with `getPosByIndex()` / `getIndexByPos()`.
- Cell size: 80x80px, item size: 60x60px.
- Linking: touch-drag adjacent same-type cakes (8-directional). Backtracking removes from chain.
- Special effects at 6+ linked cakes (line/cross), then every 4 more.
- Touch locked during dialogs/animations via `fightScene.isLevelStart`, `isLevelOver`, `reliveByAd` flags.

**Level flow:**
1. Player selects level in PVE → `fightScene.start()` → `playerData.startNewLevel()`
2. Touch input → link mechanics → `gameLogic.finishLink()` → target updates
3. Win: all targets = 0. Lose: steps ≤ 0 (one ad-revive attempt allowed per level, +5 steps)

### Level Data (`assets/resources/datas/level.csv`)
Columns: ID, name, limit (steps), cakes (available types), targets ("cakeType-count|..."), stars (score thresholds), golds (reward per star). Level progression requires ≥1 star; gold rewards only granted when improving star count.

### UI Convention
Each UI panel has a script + prefab pair. The path passed to `uiManager.instance.showDialog()` must match both:
- Prefab: `resources/prefab/ui/fight/adStep.prefab`
- Script: `scripts/ui/fight/adStep.ts`
- Usage: `uiManager.instance.showDialog('fight/adStep')`

### Game Data Tables (`assets/resources/datas/`)
CSV tables: `level`, `prop`, `signIn`, `lottery`, `gift`, `task`. All loaded via `CSVManager`.

### Ad System
25+ ad call points are pre-wired throughout the codebase but all ad methods in `GameLogic` are empty stubs (`showRewardAd`, `showInterStitialAd`, `getOpenRewardType` returns `NULL`). To activate ads, implement these methods with WeChat `wx.createRewardedVideoAd` / `wx.createInterstitialAd` APIs.

## Key Conventions

- All framework services are singletons: `ClassName.instance`.
- Game state changes flow through `clientEvent.dispatchEvent()` — grep for event name strings to trace data flow.
- Code and comments are primarily in Chinese (中文).
- Props unlock progressively by level milestone (`UNLOCK_PROP_ID` array in constants).
- Asset replacement: same-name file override in place; do not delete `.meta` files. Directories with `AutoAtlas.pac` auto-repack on editor open.
