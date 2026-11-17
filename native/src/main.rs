#![windows_subsystem = "windows"]

use std::{borrow::Cow, env, error::Error, path::PathBuf};

use winit::{
    application::ApplicationHandler,
    dpi::LogicalSize,
    event::WindowEvent,
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    window::{Icon, Theme as WindowTheme, Window, WindowId},
};
use wry::{
    http::{header::CONTENT_TYPE, Response, StatusCode},
    Theme as WebViewTheme, WebContext, WebView, WebViewBuilder, WebViewBuilderExtWindows,
};

const ICON_64_RGBA: &[u8] = include_bytes!("../icon_64.rgba");
const INDEX_HTML: &[u8] = include_bytes!("../../index.html");
const STYLES_CSS: &[u8] = include_bytes!("../../styles.css");
const APP_JS: &[u8] = include_bytes!("../../app.js");
const PROJECT_DATA_JS: &[u8] = include_bytes!("../../project-data.js");
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
        "/project-data.js" => Some(("application/javascript; charset=utf-8", PROJECT_DATA_JS)),
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

fn run_app() -> Result<(), Box<dyn Error>> {
    let event_loop = EventLoop::new()?;
    event_loop.set_control_flow(ControlFlow::Wait);
    let mut app = App::default();
    event_loop.run_app(&mut app)?;
    match app.startup_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

#[derive(Default)]
struct App {
    native_window: Option<NativeWindow>,
    startup_error: Option<Box<dyn Error>>,
}

// Fields drop in declaration order: release the WebView before its window/context.
struct NativeWindow {
    _webview: WebView,
    _window: Window,
    _web_context: WebContext,
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.native_window.is_some() || self.startup_error.is_some() {
            return;
        }
        match create_window(event_loop) {
            Ok(window) => self.native_window = Some(window),
            Err(error) => {
                self.startup_error = Some(error);
                event_loop.exit();
            }
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        _window_id: WindowId,
        event: WindowEvent,
    ) {
        if matches!(event, WindowEvent::CloseRequested) {
            event_loop.exit();
        }
    }
}

fn create_window(event_loop: &ActiveEventLoop) -> Result<NativeWindow, Box<dyn Error>> {
    let icon = Icon::from_rgba(ICON_64_RGBA.to_vec(), 64, 64).ok();

    let attributes = Window::default_attributes()
        .with_title("SimpleCAD — 2D & 3D Floorplan Studio")
        .with_inner_size(LogicalSize::new(1400.0, 880.0))
        .with_min_inner_size(LogicalSize::new(360.0, 520.0))
        .with_theme(Some(WindowTheme::Dark))
        .with_window_icon(icon)
        .with_visible(false);
    let window = event_loop.create_window(attributes)?;

    let mut web_context = WebContext::new(Some(user_data_dir()));

    let webview = WebViewBuilder::new_with_web_context(&mut web_context)
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
    window.focus_window();

    Ok(NativeWindow {
        _webview: webview,
        _window: window,
        _web_context: web_context,
    })
}
