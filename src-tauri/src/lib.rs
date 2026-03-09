mod commands;
mod models;
mod provider_http;
mod simulator;
mod state;

use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::WebviewWindowBuilder,
    Manager, WebviewUrl,
};

use crate::{commands::*, state::AppState};

const APP_ICON: Image<'_> = tauri::include_image!("./icons/32x32.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::load().expect("failed to initialize MeetingClaw state");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(app_state.clone())
        .setup(move |app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.set_title("MeetingClaw");
            }

            let overlay = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::default())
                .title("MeetingClaw Overlay")
                .transparent(true)
                .decorations(false)
                .resizable(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .inner_size(420.0, 720.0)
                .visible(false)
                .build()?;
            let _ = overlay.hide();

            TrayIconBuilder::new()
                .icon(APP_ICON.clone())
                .tooltip("MeetingClaw")
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            app_state.emit_snapshot(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_snapshot,
            start_session,
            stop_session,
            toggle_overlay,
            toggle_main_window,
            update_settings,
            update_provider_config,
            test_provider_connection,
            generate_copilot_preview,
            ingest_transcript_segment,
            ingest_screen_insight,
            transcribe_audio_chunk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
