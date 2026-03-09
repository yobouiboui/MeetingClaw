# Windows build workaround

Local native compilation is currently blocked on this machine by a Windows security policy that refuses Cargo build script binaries named `build-script-build`.

The practical workaround is to build `MeetingClaw` on a clean Windows runner through GitHub Actions.

## Workflow

The workflow file is:

- `.github/workflows/windows-build.yml`

It uses the official Tauri GitHub Action and uploads Windows workflow artifacts for both debug and release builds.

## How to use it

1. Put `MeetingClaw` in its own Git repository.
2. Push the repository to GitHub.
3. Open the `Actions` tab.
4. Run `Windows Build`, or push to `main` / `master`.
5. Download the generated workflow artifacts from the run summary.

## Why this is needed

On this machine:

- `npm run build` works
- `npm run lint` works
- `cargo check` fails before the app code is compiled

The failure happens when Cargo tries to execute generated build script binaries in `target\debug\build\...\build-script-build`.

## Source references

- Tauri GitHub pipelines docs: https://v2.tauri.app/ja/distribute/pipelines/github/
- Official `tauri-action`: https://github.com/tauri-apps/tauri-action
