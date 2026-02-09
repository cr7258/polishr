# AGENTS.md - Polishr Project Knowledge Base

> **IMPORTANT**: After ANY structural change (new features, architecture changes, new conventions, dependency changes, new files/directories), you MUST review and update this file. Ask yourself: "Does AGENTS.md still accurately describe the project?"

## Project Overview

Polishr is a Grammarly-like desktop application for grammar polishing and translation. It supports:

- **Polish English**: Fix grammar, spelling, punctuation, improve clarity
- **Polish Chinese**: Fix Chinese grammar, remove redundancy, improve expression
- **Translate CN to EN**: Translate Chinese to natural, polished English

The app runs as a system tray utility. Users select text in **any** application, press a global hotkey (`Cmd+Option+P`), and Polishr captures the text, polishes it via an LLM, and replaces it in-place.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust backend + WebView frontend) |
| Frontend | React 19 + TypeScript |
| Styling | TailwindCSS 4 + custom design tokens (shadcn/ui pattern) |
| Build tool | Vite |
| LLM integration | OpenAI-compatible API via raw `fetch` + SSE streaming |
| Diff engine | diff-match-patch |
| Keyboard simulation | `enigo` crate (Rust, cross-platform) |
| Tauri plugins | `global-shortcut`, `clipboard-manager`, `store` |

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
│   ├── App.tsx                   # Root component - wires everything together
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
│   │   ├── TitleBar.tsx          # Frameless window title bar with drag region
│   │   ├── ModeSelector.tsx      # Polish EN / Polish ZH / CN->EN mode tabs
│   │   ├── Editor.tsx            # Text input area with character count
│   │   ├── DiffView.tsx          # Inline diff with color-coded changes
│   │   ├── ResultPanel.tsx       # Bottom bar: Replace / Copy buttons
│   │   ├── Settings.tsx          # API configuration modal
│   │   └── AccessibilityGuide.tsx # macOS accessibility permission prompt
│   ├── hooks/
│   │   ├── usePolish.ts          # Streaming polish state management
│   │   └── useSettings.ts        # Settings persistence via tauri-plugin-store
│   └── styles/
│       └── globals.css           # TailwindCSS + design tokens (light/dark)
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json           # Window config, plugins, bundle settings
│   ├── capabilities/
│   │   └── default.json          # Plugin permissions
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Tauri app setup, plugin init, window events
│       ├── commands.rs           # capture_selection, replace_selection, check_accessibility_permission
│       └── tray.rs               # System tray icon and menu
└── .cursor/
    └── rules/
        └── agents-md-update.mdc  # Rule enforcing AGENTS.md updates
```

## Architecture Decisions

### Why raw `fetch` instead of OpenAI SDK?
The OpenAI SDK adds unnecessary weight and has Node.js-specific dependencies. Raw `fetch` + SSE parsing works in both Tauri WebView and browser extension contexts (for future extensibility). The client is ~60 lines of code.

### Why `src/core/` is separated?
`src/core/` contains pure TypeScript with zero React or Tauri imports. This makes it extractable into a shared `packages/core` package when the browser extension is built later.

### Why `enigo` for keyboard simulation?
`enigo` is a mature cross-platform Rust crate for input simulation. It uses `CGEvent` on macOS, `SendInput` on Windows, and X11/Wayland on Linux. It requires macOS Accessibility permission.

### System-wide replace flow
1. User selects text in any app and presses `Cmd+Shift+P`
2. Rust backend saves clipboard, simulates `Cmd+C`, reads clipboard to capture text
3. Polishr window shows with captured text
4. User clicks "Polish" -> LLM streams result -> diff displayed
5. User clicks "Replace" -> result written to clipboard -> window hidden -> `Cmd+V` simulated
6. Original clipboard content restored after paste

### Settings storage
Settings are persisted via `tauri-plugin-store` to a JSON file in the OS app data directory. The store uses `defaults` for initial values and `autoSave` for automatic persistence.

## Coding Conventions

- **Shared logic** goes in `src/core/` -- must remain free of React/Tauri imports
- **Components**: one component per file, file name matches export name, use named exports
- **No default exports** anywhere in the codebase
- **TypeScript strict mode** enabled (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Icons**: Lucide React only, no emoji as UI icons
- **Clickable elements**: always add `cursor-pointer` class
- **Transitions**: 200ms duration for hover/focus states
- **Dark mode**: follows system preference, applied via `.dark` class on `<html>`
- **CSS variables**: design tokens defined in `globals.css` using oklch color space

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm tauri dev        # Run the app in development mode (frontend + Rust)
pnpm dev              # Run only the Vite frontend dev server
pnpm build            # Build the frontend for production
pnpm tauri build      # Build the full desktop app (DMG/MSI/AppImage)
```

## Key Dependencies

### Frontend (npm)
- `@tauri-apps/api` - Tauri JavaScript API
- `@tauri-apps/plugin-global-shortcut` - Global hotkey registration
- `@tauri-apps/plugin-clipboard-manager` - Clipboard read/write
- `@tauri-apps/plugin-store` - Persistent settings storage
- `diff-match-patch` - Text diff computation
- `lucide-react` - SVG icons

### Backend (Cargo)
- `tauri` v2 with `tray-icon` feature
- `tauri-plugin-global-shortcut` v2
- `tauri-plugin-clipboard-manager` v2
- `tauri-plugin-store` v2
- `enigo` v0.3 - Cross-platform keyboard/mouse simulation
- `serde` + `serde_json` - Serialization

## Future Plans

- **Browser extension**: Extract `src/core/` into `packages/core`, build WXT-based extension
- **More languages**: Add more polishing/translation modes
- **Custom prompts**: Let users define their own system prompts
- **History**: Store recent polishing sessions
