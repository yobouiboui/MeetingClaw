# MeetingClaw

Windows-first desktop meeting copilot built with `Tauri 2`, `React`, `TypeScript` and `Rust`.

## Current scope

This repository currently includes:

- a Windows desktop shell with tray integration
- a main workspace UI for live transcript, suggestions, notes and history
- an overlay window for in-meeting cues
- global shortcut registration from the frontend
- local persisted settings and meeting history
- a simulated realtime session pipeline ready to be replaced with real audio, OCR and LLM adapters
- a GitHub Actions workflow for Windows builds

## Current implementation status

The app now includes:

- continuous microphone capture from the webview with chunked transcription handoff
- continuous screen capture with OCR extraction and stable-frame throttling
- provider adapters for `OpenAI`, `Claude`, `Gemini` and `Ollama`
- local SQLite meeting history persistence
- browser/demo mode fallback when the Tauri runtime is unavailable

## Local validation

On this machine:

- `npm run build` passes
- `npm run lint` passes
- `cargo check` passes under `WSL Ubuntu`
- `cargo test --lib` passes under `WSL Ubuntu`

The documented workaround is in [docs/build-workaround.md](./docs/build-workaround.md).

## Browser demo mode

Even without the native Tauri runtime, the frontend now runs in a browser demo mode with:

- simulated realtime meeting flow
- prompt composition preview
- playbooks
- searchable history
- markdown export for the current session

## Run the frontend locally

```powershell
npm install
npm run build
npm run lint
```

Rust validation from WSL:

```powershell
wsl.exe -d Ubuntu -- sh -lc '. "$HOME/.cargo/env" && cd /mnt/c/Users/Yohan.BOUYSSIERE/Projects/MeetingClaw/src-tauri && cargo check && cargo test --lib'
```

## Build on GitHub Actions

1. Push the latest `main` branch.
2. Open the `Actions` tab.
3. Run `Windows Build` if it did not start automatically.
4. Wait for frontend lint/build, Rust check/tests and the Tauri bundle steps to pass.
5. Download the generated `NSIS` installer artifact.

The workflow lives in `.github/workflows/windows-build.yml`.

The Windows packaging notes live in [docs/windows-release.md](./docs/windows-release.md).

## Project structure

```text
src/         React UI, state and Tauri bindings
src-tauri/   Rust backend, windows, tray and session runtime
docs/        Build notes and project documentation
```
