# AGENTS.md - Polishr Project Knowledge Base

> **IMPORTANT**: After ANY structural change (new features, architecture changes, new conventions, dependency changes, new files/directories), you MUST review and update this file. Ask yourself: "Does AGENTS.md still accurately describe the project?"

## Project Overview

Polishr is a Grammarly-like desktop application for grammar polishing and translation. It supports:

- **Improve**: Fix grammar, spelling, punctuation, improve clarity (auto-detects language)
- **Rephrase**: Rewrite with different words/structure (auto-detects language)
- **Translate**: Translate between Chinese and English (auto-detects source, translates to opposite)

The app has **three windows** in a single Tauri process:

1. **Floating Panel** (`main` window) — compact, transparent, always-on-top panel near the selection. Shows explanation + diff + accept/copy actions. Appears on `Cmd+Option+P`. Auto-dismisses on focus loss.
2. **Selection Trigger** (`trigger` window) — always-on-top button/line shown near text. Has two modes: **Selection mode** (blue button near selected text) and **Paragraph mode** (gray vertical line next to the paragraph when cursor is in a text field without selection; turns into a white button on hover). Clicking opens the floating panel.
3. **Desktop Settings** (`settings` window) — full settings window with sidebar navigation. Configures API providers, views history, sets preferences. Opens from tray menu.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust backend + WebView frontend) |
| Frontend | React 19 + TypeScript |
| Routing | Window label detection (`main` / `trigger` / `settings`) |
| Styling | TailwindCSS 4 + custom design tokens (shadcn/ui pattern) |
| Build tool | Vite |
| LLM integration | OpenAI-compatible API via raw `fetch` + SSE streaming |
| Diff engine | diff-match-patch |
| Language detection | Unicode CJK ratio (`src/core/lang/detect.ts`) |
| Text capture | macOS Accessibility API (`AXUIElement` FFI) — reads selected text |
| Text replace | Clipboard + `osascript` Cmd+V — universally reliable |
| Tauri plugins | `global-shortcut`, `store` |

## Project Structure

```
polishr/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── AGENTS.md                     # This file - agent knowledge base
├── src/                          # React frontend
│   ├── main.tsx                  # Entry: routes by window label (main→App, trigger→TriggerWindow, settings→DesktopApp)
│   ├── App.tsx                   # Floating panel root component
│   ├── TriggerWindow.tsx         # Tiny selection-trigger button window
│   ├── TriggerWindow.css         # Component-scoped trigger styles
│   ├── vite-env.d.ts
│   ├── lib/
│   │   └── utils.ts              # cn() utility for class merging
│   ├── core/                     # Pure TypeScript logic (NO React/Tauri deps)
│   │   ├── llm/
│   │   │   ├── types.ts          # PolishrConfig, PolishMode, Provider, HistoryRecord, PROVIDER_PRESETS
│   │   │   ├── client.ts         # polishStream() async generator (accepts lang param)
│   │   │   └── stream.ts         # SSE parser for OpenAI-compatible APIs
│   │   ├── prompts/
│   │   │   ├── index.ts          # getPrompt(mode, lang) — routes by mode + detected language
│   │   │   ├── improve.ts        # Universal improve prompt (same-language polish)
│   │   │   ├── rephrase.ts       # Universal rephrase prompt (same-language rewrite)
│   │   │   └── translate.ts      # Dynamic translate prompt (getTranslatePrompt(sourceLang))
│   │   ├── lang/
│   │   │   └── detect.ts         # detectLanguage() — CJK ratio auto-detection
│   │   └── diff/
│   │       └── differ.ts         # computeDiff(), hasChanges()
│   ├── pages/                    # Desktop settings pages
│   │   ├── DesktopApp.tsx        # Desktop layout: sidebar + content area
│   │   ├── ProvidersPage.tsx     # API provider cards + config form
│   │   ├── HistoryPage.tsx       # History list with search + copy
│   │   └── PreferencesPage.tsx   # Default action, hotkey display
│   ├── components/
│   │   └── DiffView.tsx          # Inline diff (green/red bg + strikethrough)
│   ├── hooks/
│   │   ├── usePolish.ts          # Streaming polish + explanation parsing + onComplete callback
│   │   ├── useSettings.ts        # Provider management, active provider, default mode
│   │   └── useHistory.ts         # History CRUD via tauri-plugin-store
│   └── styles/
│       └── globals.css           # TailwindCSS + design tokens (light/dark), transparent bg
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json           # Three windows: main (floating), trigger (selection button), settings (desktop)
│   ├── capabilities/
│   │   └── default.json          # Plugin permissions for all windows
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Tauri app setup, hotkey handler, trigger poller, window positioning, blur-dismiss
│       ├── ax_text.rs            # macOS AX API FFI (read selected text, get bounds, paragraph detection, select range) + clipboard/paste helpers
│       ├── commands.rs           # capture, cached selection/paragraph open, replace_text, dismiss, permission check
│       └── tray.rs               # System tray: "Settings" opens desktop window, "Quit" exits
└── .cursor/
    └── rules/
        └── agents-md-update.mdc  # Rule enforcing AGENTS.md updates
```

## Architecture Decisions

### Multi-window architecture
The floating panel, selection trigger, and desktop settings share a single Tauri process. `main.tsx` checks `getCurrentWindow().label` to decide which React tree to render. Data is shared via `tauri-plugin-store` (two store files: `settings.json` for providers/preferences, `history.json` for records).

### Passive selection trigger (Grammarly-style)
On macOS, a background poller in `lib.rs` checks current AX selection roughly every 350ms. Polling uses a lightweight AX read path (`peek_selection_ax`) that skips frontmost-app storage. The trigger has two modes:

- **Selection mode**: If valid selected text exists, shows a blue button to the left of the selection. Single-line selections get a circle (`rounded-full`), multi-line selections get a pill shape (`rounded-[8px]`). The trigger window height matches the selection height. Clicking calls `open_main_from_cached_selection`.
- **Paragraph mode**: If no text is selected but the cursor is in a text field, detects the current paragraph (newline-delimited) via `peek_paragraph_ax()`. Shows a thin gray vertical line (4px) alongside the paragraph. On hover, it expands to a white button with a chevron. Clicking calls `select_paragraph_and_open`, which uses `AXUIElementSetAttributeValue` to set `AXSelectedTextRange` on the focused element, then opens the main panel.

Mode changes are communicated to the frontend via the `trigger-mode` Tauri event (`"selection"` or `"paragraph"`).

### Provider system
Instead of a single API config, providers are stored as an array in the store. Each has `{id, name, endpoint, apiKey, model, temperature}`. One is marked as `activeProviderId`. Built-in presets: DeepSeek, OpenAI, OpenRouter, MiniMax. Legacy flat config is auto-migrated on first load.

### Auto language detection
`detectLanguage(text)` uses CJK Unicode ratio (>30% → Chinese). Improve and Rephrase prompts are language-agnostic (they instruct the LLM to "keep the same language as input"). Translate uses `getTranslatePrompt(sourceLang)` to dynamically set the target language.

### Why a hybrid AX API + clipboard approach?
**Capture**: The AX API reads `kAXSelectedTextAttribute` directly from the focused UI element — instant and doesn't touch the clipboard. **Replace**: We tried `AXUIElementSetAttributeValue` for writes, but many apps silently ignore it. The universally reliable approach is: clipboard + `osascript` Cmd+V.

### Auto-dismiss on blur
The floating panel auto-hides when it loses focus (`WindowEvent::Focused(false)`). The panel gets focus on show via `set_focus()`. Stored element is NOT cleared on blur (needed for Accept to work).

### History
Every successful polish saves a `HistoryRecord` to `history.json` via `useHistory.addRecord()`. Max 200 records. The Desktop History page shows them with search, time-ago, mode badge, and copy button.

### LLM response format (explanation + text)
All prompts instruct the LLM to output a short explanation (first line, under 8 words) followed by a blank line, then the polished text. `usePolish.ts` parses this at stream completion via `parseResponse()`.

### System-wide flow
1. User selects text in any app (or places cursor in a paragraph)
2. User either presses `Cmd+Option+P`, clicks the blue `trigger` button near the selection, or hovers the gray paragraph line and clicks the white button
3. Rust backend uses AX API to read selected text + bounds (or cached selection/paragraph from the poller) and opens `main` above the selection
4. Floating panel auto-polishes via LLM; user reviews the diff and clicks Accept/Copy or enters "Ask for a change"
5. Panel hides, replacement text is copied to clipboard, original app is activated, Cmd+V simulated
6. History record saved automatically

## Git Commit Convention

Use **explicit** commit messages with a type prefix:

| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat: add desktop settings window with provider management` |
| `fix` | Bug fix | `fix: prevent Reopen event firing after Accept` |
| `doc` | Documentation | `doc: update AGENTS.md with multi-window architecture` |
| `perf` | Performance | `perf: reduce AX API polling interval` |
| `refactor` | Code restructure | `refactor: merge language-specific prompts into unified templates` |
| `test` | Tests | `test: add unit test for language detection` |
| `chore` | Dependencies/config | `chore: add react-router-dom dependency` |
| `style` | Formatting | `style: fix inconsistent indentation in App.tsx` |
| `revert` | Revert changes | `revert: revert clipboard-based replacement` |

## Coding Conventions

- **Clean up after trial-and-error**: When iterating, audit and remove dead code from abandoned approaches. Run `cargo check` and `npx tsc --noEmit` to verify zero warnings.
- **Shared logic** goes in `src/core/` — must remain free of React/Tauri imports
- **Components**: one component per file, file name matches export name, use named exports
- **No default exports** anywhere in the codebase
- **TypeScript strict mode** enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Icons**: Lucide React only, no emoji as UI icons
- **Clickable elements**: always add `cursor-pointer` class
- **Transitions**: 200ms duration for hover/focus states
- **Dark mode**: follows system preference, applied via `.dark` class on `<html>`
- **CSS variables**: design tokens defined in `globals.css` using oklch color space
- **Transparent window**: body background is transparent; the card component provides the visible panel
- **Multi-window**: all windows share the same React build; routing is by window label, not URL

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm tauri dev        # Run the app in development mode (frontend + Rust)
pnpm dev              # Run only the Vite frontend dev server
pnpm build            # Build the frontend for production
pnpm tauri build      # Build the full desktop app (DMG)
```

## Key Dependencies

### Frontend (npm)
- `@tauri-apps/api` - Tauri JavaScript API (window, event, invoke)
- `@tauri-apps/plugin-store` - Persistent settings storage
- `react-router-dom` - (installed but routing done via window label)
- `diff-match-patch` - Text diff computation
- `lucide-react` - SVG icons

### Backend (Cargo)
- `tauri` v2 with `tray-icon` feature
- `tauri-plugin-global-shortcut` v2
- `tauri-plugin-store` v2
- `serde` + `serde_json` - Serialization

### macOS native (via FFI + CLI, no crate dependency)
- `ApplicationServices.framework` - `AXUIElement*` functions for reading selected text
- `CoreFoundation.framework` - `CFString*` functions for string conversion
- `CoreGraphics.framework` - `CGEvent*` for mouse position fallback
- `osascript` - AppleScript for app activation and `Cmd+V` simulation
- `pbcopy` - Set clipboard content for replacement

## Future Plans

- **Cross-platform**: Add Windows/Linux text access (UI Automation API, AT-SPI)
- **Browser extension**: Extract `src/core/` into `packages/core`, build WXT-based extension
- **More languages**: Expand `DetectedLang` and `TARGET_LANG_NAME` in translate prompt
- **Custom prompts**: Let users define their own system prompts
- **Dark mode for desktop**: Add theme toggle in Preferences
