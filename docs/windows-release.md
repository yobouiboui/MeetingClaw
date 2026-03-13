# Windows Release Notes

`MeetingClaw` currently targets `Windows` only and ships as an `NSIS` installer through `Tauri 2`.

## What the CI pipeline now validates

- `npm ci`
- `npm run lint`
- `npm run build`
- `cargo check --lib`
- `cargo test --lib`
- `tauri build`

This means the workflow fails before packaging if the frontend or Rust library regresses.

## Installer configuration

The installer is configured in [src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json) with:

- `NSIS` target only
- `currentUser` install mode
- `English` and `French` language packs
- `silent` WebView2 bootstrapper download
- `LZMA` compression
- `MeetingClaw` Start Menu folder

## Release checklist

1. Done: `npm run lint` passes locally.
2. Done: `npm run build` passes locally.
3. Done: WSL Rust validation passes locally.
4. Done: latest release changes are pushed to `main`.
5. Done: `Windows Build #25` succeeded on March 10, 2026.
6. Remaining: download and smoke-test the generated installer on Windows.

## Current artifact

- Workflow run: `Windows Build #25`
- Commit: `df6ad7c`
- Artifact name: `meetingclaw-windows-nsis`
- Artifact digest: `sha256:b29af8fd4f83fcf8c709334221ab332191f0635deda44c6d636bac1a7f71aeb7`

## Remaining production gaps

- native Windows audio capture beyond `MediaRecorder`
- stronger long-session telemetry and crash diagnostics
- real screenshot OCR offload strategy if CPU usage is too high on low-end hardware
- signed Windows installer and update channel
- final installer smoke test on a clean Windows machine
