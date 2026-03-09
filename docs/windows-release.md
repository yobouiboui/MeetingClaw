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

1. Confirm `npm run lint` passes locally.
2. Confirm `npm run build` passes locally.
3. Confirm WSL Rust validation passes locally.
4. Push to `main`.
5. Verify the `Windows Build` GitHub Actions run succeeds.
6. Download and smoke-test the generated installer on Windows.

## Remaining production gaps

- native Windows audio capture beyond `MediaRecorder`
- stronger long-session telemetry and crash diagnostics
- real screenshot OCR offload strategy if CPU usage is too high on low-end hardware
- signed Windows installer and update channel
