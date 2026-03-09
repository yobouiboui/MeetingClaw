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

## Local status

On this machine:

- `npm run build` passes
- `npm run lint` passes
- native Cargo/Tauri compilation is blocked by a local Windows execution policy affecting Cargo build scripts

The documented workaround is in [docs/build-workaround.md](./docs/build-workaround.md).

## Run the frontend locally

```powershell
npm install
npm run build
npm run lint
```

## Build on GitHub Actions

1. Create a dedicated GitHub repository for `MeetingClaw`.
2. Push this project.
3. Open the `Actions` tab.
4. Run `Windows Build`.
5. Download the generated Windows artifacts.

The workflow lives in `.github/workflows/windows-build.yml`.

## Project structure

```text
src/         React UI, state and Tauri bindings
src-tauri/   Rust backend, windows, tray and session runtime
docs/        Build notes and project documentation
```
