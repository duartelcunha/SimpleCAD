#![windows_subsystem = "windows"]

use std::{borrow::Cow, env, path::PathBuf};

use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::{Icon, Theme as WindowTheme, WindowBuilder},
};
use wry::{
    http::{header::CONTENT_TYPE, Response, StatusCode},
    Theme as WebViewTheme, WebContext, WebViewBuilder, WebViewBuilderExtWindows,
};

const ICON_64_RGBA: &[u8] = include_bytes!("../icon_64.rgba");
const INDEX_HTML: &[u8] = include_bytes!("../../index.html");
const STYLES_CSS: &[u8] = include_bytes!("../../styles.css");
const APP_JS: &[u8] = include_bytes!("../../app.js");
const DEFAULT_ROOM_JS: &[u8] = include_bytes!("../../default-room.js");
const ICON_SVG: &[u8] = include_bytes!("../../icon.svg");

fn user_data_dir() -> PathBuf {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    let dir = base.join("SimpleCAD").join("WebView2");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn embedded_asset(path: &str) -> Option<(&'static str, &'static [u8])> {
    match path {
        "/" | "/index.html" => Some(("text/html; charset=utf-8", INDEX_HTML)),
        "/styles.css" => Some(("text/css; charset=utf-8", STYLES_CSS)),
        "/app.js" => Some(("application/javascript; charset=utf-8", APP_JS)),
        "/default-room.js" => Some(("application/javascript; charset=utf-8", DEFAULT_ROOM_JS)),
        "/icon.svg" => Some(("image/svg+xml; charset=utf-8", ICON_SVG)),
        _ => None,
    }
}

fn main() {
    if let Err(err) = run_app() {
        let log_path = user_data_dir().join("error.log");
        let _ = std::fs::write(log_path, format!("{err:?}"));
    }
}

fn run_app() -> wry::Result<()> {
    let event_loop = EventLoop::new();
    let icon = Icon::from_rgba(ICON_64_RGBA.to_vec(), 64, 64).ok();

    let window = WindowBuilder::new()
        .with_title("SimpleCAD — 2D & 3D Floorplan Studio")
        .with_inner_size(LogicalSize::new(1400.0, 880.0))
        .with_min_inner_size(LogicalSize::new(360.0, 520.0))
        .with_theme(Some(WindowTheme::Dark))
        .with_window_icon(icon)
        .with_visible(false)
        .build(&event_loop)
        .expect("failed to build native window");

    let mut web_context = WebContext::new(Some(user_data_dir()));

    let _webview = WebViewBuilder::new_with_web_context(&mut web_context)
        .with_theme(WebViewTheme::Dark)
        .with_background_color((13, 14, 16, 255))
        .with_clipboard(true)
        .with_default_context_menus(false)
        .with_browser_accelerator_keys(false)
        .with_custom_protocol("simplecad".into(), |_webview_id, request| {
            let path = request.uri().path();
            if let Some((mime, bytes)) = embedded_asset(path) {
                Response::builder()
                    .status(StatusCode::OK)
                    .header(CONTENT_TYPE, mime)
                    .body(Cow::Borrowed(bytes))
                    .unwrap()
            } else {
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(CONTENT_TYPE, "text/plain; charset=utf-8")
                    .body(Cow::Borrowed(b"Not Found" as &[u8]))
                    .unwrap()
            }
        })
        .with_url("simplecad://localhost/index.html")
        .build(&window)?;

    window.set_visible(true);
    window.set_focus();

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *control_flow = ControlFlow::Exit;
        }
    });
}
