# AGENTS.md - Polishr Project Knowledge Base

> **IMPORTANT**: After ANY structural change (new features, architecture changes, new conventions, dependency changes, new files/directories), you MUST review and update this file. Ask yourself: "Does AGENTS.md still accurately describe the project?"

## Project Overview

Polishr is a Grammarly-like desktop application for grammar polishing and translation. It supports:

- **Polish English**: Fix grammar, spelling, punctuation, improve clarity
- **Polish Chinese**: Fix Chinese grammar, remove redundancy, improve expression
- **Translate CN to EN**: Translate Chinese to natural, polished English

The app runs as a system tray utility with a floating panel UI. Users select text in **any** application, press a global hotkey (`Cmd+Option+P`), and a compact floating panel appears near the selection. The panel shows the polished result with inline diff. Clicking "Accept" replaces the text in-place by activating the original app and pasting from clipboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust backend + WebView frontend) |
| Frontend | React 19 + TypeScript |
| Styling | TailwindCSS 4 + custom design tokens (shadcn/ui pattern) |
| Build tool | Vite |
| LLM integration | OpenAI-compatible API via raw `fetch` + SSE streaming |
| Diff engine | diff-match-patch |
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
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Floating panel root component
│   ├── vite-env.d.ts
│   ├── lib/
│   │   └── utils.ts              # cn() utility for class merging
│   ├── core/                     # Pure TypeScript logic (NO React/Tauri deps)
│   │   ├── llm/
│   │   │   ├── types.ts          # PolishrConfig, PolishMode, ChatMessage
│   │   │   ├── client.ts         # polishStream() async generator
│   │   │   └── stream.ts         # SSE parser for OpenAI-compatible APIs
│   │   ├── prompts/
│   │   │   ├── index.ts          # getPrompt(mode) selector
│   │   │   ├── polish-en.ts      # English polishing system prompt
│   │   │   ├── polish-zh.ts      # Chinese polishing system prompt
│   │   │   └── translate.ts      # CN->EN translation system prompt
│   │   └── diff/
│   │       └── differ.ts         # computeDiff(), hasChanges()
│   ├── components/
│   │   ├── DiffView.tsx          # Inline diff with color-coded changes
│   │   └── Settings.tsx          # API configuration modal
│   ├── hooks/
│   │   ├── usePolish.ts          # Streaming polish state management
│   │   └── useSettings.ts        # Settings persistence via tauri-plugin-store
│   └── styles/
│       └── globals.css           # TailwindCSS + design tokens (light/dark), transparent bg
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json           # Floating panel window config (transparent, always-on-top)
│   ├── capabilities/
│   │   └── default.json          # Plugin permissions
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Tauri app setup, hotkey handler, window positioning
│       ├── ax_text.rs            # macOS AX API FFI (read selected text, get bounds) + clipboard/paste helpers
│       ├── commands.rs           # capture_and_locate, replace_text, dismiss, check_accessibility_permission
│       └── tray.rs               # System tray icon and menu
└── .cursor/
    └── rules/
        └── agents-md-update.mdc  # Rule enforcing AGENTS.md updates
```

## Architecture Decisions

### Why a hybrid AX API + clipboard approach?
**Capture**: The AX API reads `kAXSelectedTextAttribute` directly from the focused UI element — instant and doesn't touch the clipboard. **Replace**: We tried `AXUIElementSetAttributeValue` for writes, but many apps (browsers, Electron apps) silently ignore it while returning success. The universally reliable approach is: copy replacement text to clipboard, activate the original app via `osascript`, and simulate `Cmd+V`. Both capture and replace require macOS Accessibility permission.

### Why a floating panel instead of a full window?
A small, transparent, always-on-top panel that appears near the selection mimics the Grammarly experience. The user stays in context — they can see their original text in the source app while reviewing the suggestion in the panel. The panel auto-polishes on capture and offers Accept/Dismiss.

### Why raw `fetch` instead of OpenAI SDK?
The OpenAI SDK adds unnecessary weight and has Node.js-specific dependencies. Raw `fetch` + SSE parsing works in both Tauri WebView and browser extension contexts (for future extensibility). The client is ~60 lines of code.

### Why `src/core/` is separated?
`src/core/` contains pure TypeScript with zero React or Tauri imports. This makes it extractable into a shared `packages/core` package when the browser extension is built later.

### System-wide flow (current)
1. User selects text in any app and presses `Cmd+Option+P`
2. Rust backend records the frontmost app name, then uses AX API to read `AXSelectedText` and `AXBoundsForRange`
3. Floating panel appears near the selection (without stealing focus) and auto-polishes via LLM
4. User reviews the inline diff and clicks "Accept"
5. Panel hides, replacement text is copied to clipboard, original app is activated, `Cmd+V` is simulated

### Settings storage
Settings are persisted via `tauri-plugin-store` to a JSON file in the OS app data directory. The store uses `defaults` for initial values and `autoSave` for automatic persistence.

## Coding Conventions

- **Clean up after trial-and-error**: When iterating on a solution (trying multiple approaches), you MUST audit and remove dead code from abandoned approaches before considering the task done. This includes: unused functions, unused structs/types, unused imports, unused dependencies (both `Cargo.toml` and `package.json`), unused files/components, and stale permissions in `capabilities/default.json`. Do NOT leave code prefixed with `_` to suppress warnings — remove it entirely. Run `cargo check` and `npx tsc --noEmit` to verify zero warnings.
- **Shared logic** goes in `src/core/` -- must remain free of React/Tauri imports
- **Components**: one component per file, file name matches export name, use named exports
- **No default exports** anywhere in the codebase
- **TypeScript strict mode** enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Icons**: Lucide React only, no emoji as UI icons
- **Clickable elements**: always add `cursor-pointer` class
- **Transitions**: 200ms duration for hover/focus states
- **Dark mode**: follows system preference, applied via `.dark` class on `<html>`
- **CSS variables**: design tokens defined in `globals.css` using oklch color space
- **Transparent window**: body background is transparent; the card component provides the visible panel

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
- **More languages**: Add more polishing/translation modes
- **Custom prompts**: Let users define their own system prompts
- **History**: Store recent polishing sessions
