#![windows_subsystem = "windows"]

use std::{
    borrow::Cow,
    collections::BTreeSet,
    env,
    error::Error,
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream, UdpSocket},
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

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
const MANIFEST_JSON: &[u8] = include_bytes!("../../manifest.webmanifest");
const SW_JS: &[u8] = include_bytes!("../../sw.js");

const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;

struct SharedSyncState {
    revision: u64,
    updated_at: u64,
    project_json: Option<String>,
    port: u16,
    token: String,
    lan_ips: Vec<String>,
    storage_file: PathBuf,
}

fn app_root_dir() -> PathBuf {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir);
    let dir = base.join("SimpleCAD");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn user_data_dir() -> PathBuf {
    let dir = app_root_dir().join("WebView2");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn load_or_create_token() -> String {
    let token_path = app_root_dir().join("sync-token.txt");
    if let Ok(existing) = fs::read_to_string(&token_path) {
        let clean: String = existing
            .trim()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();
        if clean.len() >= 12 {
            return clean;
        }
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0x51a7_ecad);
    let pid = u128::from(std::process::id());
    let mixed = nanos ^ (pid << 32) ^ 0x9e37_79b9_7f4a_7c15;
    let token = format!("{mixed:016x}");
    let _ = fs::write(&token_path, &token);
    token
}

fn detect_lan_ips() -> Vec<String> {
    let mut ips = BTreeSet::new();
    for target in [
        "192.168.1.1:80",
        "10.0.0.1:80",
        "172.16.0.1:80",
        "8.8.8.8:80",
    ] {
        if let Ok(sock) = UdpSocket::bind("0.0.0.0:0") {
            if sock.connect(target).is_ok() {
                if let Ok(addr) = sock.local_addr() {
                    let ip = addr.ip();
                    if !ip.is_loopback() && !ip.is_unspecified() {
                        ips.insert(ip.to_string());
                    }
                }
            }
        }
    }
    if ips.is_empty() {
        ips.insert("127.0.0.1".to_string());
    }
    ips.into_iter().collect()
}

fn embedded_asset(path: &str) -> Option<(&'static str, &'static [u8])> {
    match path {
        "/" | "/index.html" => Some(("text/html; charset=utf-8", INDEX_HTML)),
        "/styles.css" => Some(("text/css; charset=utf-8", STYLES_CSS)),
        "/app.js" => Some(("application/javascript; charset=utf-8", APP_JS)),
        "/project-data.js" => Some(("application/javascript; charset=utf-8", PROJECT_DATA_JS)),
        "/default-room.js" => Some(("application/javascript; charset=utf-8", DEFAULT_ROOM_JS)),
        "/icon.svg" => Some(("image/svg+xml; charset=utf-8", ICON_SVG)),
        "/manifest.webmanifest" => {
            Some(("application/manifest+json; charset=utf-8", MANIFEST_JSON))
        }
        "/sw.js" => Some(("application/javascript; charset=utf-8", SW_JS)),
        _ => None,
    }
}

fn query_param<'a>(query: &'a str, key: &str) -> Option<&'a str> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        if parts.next() == Some(key) {
            return parts.next();
        }
    }
    None
}

fn handle_api_request(
    method: &str,
    path: &str,
    query: &str,
    body: &[u8],
    is_trusted_host: bool,
    sync_state: &Arc<Mutex<SharedSyncState>>,
) -> (u16, &'static str, Vec<u8>) {
    let Ok(mut state) = sync_state.lock() else {
        return (
            500,
            "application/json; charset=utf-8",
            b"{\"error\":\"lock\"}".to_vec(),
        );
    };

    let supplied_token = query_param(query, "token").unwrap_or("");
    let authorized = is_trusted_host || (!state.token.is_empty() && supplied_token == state.token);

    if path == "/api/sync-info" && method == "GET" {
        if !authorized {
            return (
                403,
                "application/json; charset=utf-8",
                b"{\"active\":false,\"error\":\"forbidden\"}".to_vec(),
            );
        }
        let urls_json: Vec<String> = state
            .lan_ips
            .iter()
            .map(|ip| format!("\"http://{}:{}/?sync={}\"", ip, state.port, state.token))
            .collect();
        let payload = format!(
            "{{\"active\":{},\"port\":{},\"token\":\"{}\",\"lanUrls\":[{}],\"revision\":{}}}",
            state.port > 0,
            state.port,
            state.token,
            urls_json.join(","),
            state.revision
        );
        return (200, "application/json; charset=utf-8", payload.into_bytes());
    }

    if path == "/api/project" {
        if !authorized {
            return (
                403,
                "application/json; charset=utf-8",
                b"{\"error\":\"invalid_token\"}".to_vec(),
            );
        }
        if method == "GET" {
            let project_raw = state.project_json.as_deref().unwrap_or("null");
            let payload = format!(
                "{{\"revision\":{},\"updatedAt\":{},\"project\":{}}}",
                state.revision, state.updated_at, project_raw
            );
            return (200, "application/json; charset=utf-8", payload.into_bytes());
        }
        if method == "POST" {
            let Ok(text) = std::str::from_utf8(body) else {
                return (
                    400,
                    "application/json; charset=utf-8",
                    b"{\"error\":\"invalid_utf8\"}".to_vec(),
                );
            };
            let trimmed = text.trim();
            if !trimmed.starts_with('{') || !trimmed.ends_with('}') || trimmed.len() < 20 {
                return (
                    400,
                    "application/json; charset=utf-8",
                    b"{\"error\":\"invalid_json\"}".to_vec(),
                );
            }
            if state.project_json.as_deref() != Some(trimmed) {
                state.revision += 1;
                state.updated_at = now_epoch_ms();
                state.project_json = Some(trimmed.to_string());
                let _ = fs::write(&state.storage_file, trimmed);
            }
            let payload = format!(
                "{{\"ok\":true,\"revision\":{},\"updatedAt\":{}}}",
                state.revision, state.updated_at
            );
            return (200, "application/json; charset=utf-8", payload.into_bytes());
        }
    }

    (
        404,
        "application/json; charset=utf-8",
        b"{\"error\":\"not_found\"}".to_vec(),
    )
}

fn handle_tcp_client(mut stream: TcpStream, sync_state: Arc<Mutex<SharedSyncState>>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(4)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(4)));

    let mut buffer = Vec::with_capacity(8192);
    let mut chunk = [0u8; 4096];
    let mut header_end = None;

    while header_end.is_none() && buffer.len() < 32 * 1024 {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => return,
            Ok(n) => {
                buffer.extend_from_slice(&chunk[..n]);
                header_end = buffer.windows(4).position(|w| w == b"\r\n\r\n");
            }
        }
    }

    let Some(h_end) = header_end else {
        return;
    };
    let body_start = h_end + 4;
    let header_str = String::from_utf8_lossy(&buffer[..h_end]).to_string();
    let mut lines = header_str.lines();
    let Some(req_line) = lines.next() else {
        return;
    };
    let mut req_parts = req_line.split_whitespace();
    let method = req_parts.next().unwrap_or("GET");
    let raw_target = req_parts.next().unwrap_or("/");

    let mut content_length = 0usize;
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            if k.trim().eq_ignore_ascii_case("content-length") {
                content_length = v.trim().parse::<usize>().unwrap_or(0);
            }
        }
    }
    if content_length > MAX_BODY_BYTES {
        return;
    }

    while buffer.len() < body_start + content_length {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => break,
            Ok(n) => buffer.extend_from_slice(&chunk[..n]),
        }
    }

    let (path, query) = raw_target.split_once('?').unwrap_or((raw_target, ""));
    let body_end = (body_start + content_length).min(buffer.len());
    let body = &buffer[body_start..body_end];

    let (status, mime, resp_body) = if path.starts_with("/api/") {
        handle_api_request(method, path, query, body, false, &sync_state)
    } else if let Some((m, bytes)) = embedded_asset(path) {
        (200, m, bytes.to_vec())
    } else {
        (404, "text/plain; charset=utf-8", b"Not Found".to_vec())
    };

    let status_text = match status {
        200 => "200 OK",
        400 => "400 Bad Request",
        403 => "403 Forbidden",
        404 => "404 Not Found",
        _ => "500 Internal Server Error",
    };

    let header = format!(
        "HTTP/1.1 {status_text}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        resp_body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(&resp_body);
    let _ = stream.flush();
}

fn start_lan_sync_server() -> Arc<Mutex<SharedSyncState>> {
    let storage_file = app_root_dir().join("shared-project.json");
    let initial_json = fs::read_to_string(&storage_file)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| s.starts_with('{') && s.ends_with('}'));

    let mut bound_listener = None;
    let mut chosen_port = 0u16;
    for port in 4173..=4183 {
        if let Ok(listener) = TcpListener::bind(("0.0.0.0", port)) {
            chosen_port = port;
            bound_listener = Some(listener);
            break;
        }
    }

    let state = Arc::new(Mutex::new(SharedSyncState {
        revision: u64::from(initial_json.is_some()),
        updated_at: now_epoch_ms(),
        project_json: initial_json,
        port: chosen_port,
        token: load_or_create_token(),
        lan_ips: detect_lan_ips(),
        storage_file,
    }));

    if let Some(listener) = bound_listener {
        let thread_state = Arc::clone(&state);
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let client_state = Arc::clone(&thread_state);
                thread::spawn(move || handle_tcp_client(stream, client_state));
            }
        });
    }

    state
}

fn main() {
    if let Err(err) = run_app() {
        let log_path = user_data_dir().join("error.log");
        let _ = fs::write(log_path, format!("{err:?}"));
    }
}

fn run_app() -> Result<(), Box<dyn Error>> {
    let sync_state = start_lan_sync_server();
    let event_loop = EventLoop::new()?;
    event_loop.set_control_flow(ControlFlow::Wait);
    let mut app = App {
        sync_state,
        native_window: None,
        startup_error: None,
    };
    event_loop.run_app(&mut app)?;
    match app.startup_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

struct App {
    sync_state: Arc<Mutex<SharedSyncState>>,
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
        match create_window(event_loop, Arc::clone(&self.sync_state)) {
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

fn create_window(
    event_loop: &ActiveEventLoop,
    sync_state: Arc<Mutex<SharedSyncState>>,
) -> Result<NativeWindow, Box<dyn Error>> {
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
        .with_custom_protocol("simplecad".into(), move |_webview_id, request| {
            let path = request.uri().path();
            let query = request.uri().query().unwrap_or("");
            if path.starts_with("/api/") {
                let (code, mime, bytes) = handle_api_request(
                    request.method().as_str(),
                    path,
                    query,
                    request.body(),
                    true,
                    &sync_state,
                );
                let status =
                    StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
                Response::builder()
                    .status(status)
                    .header(CONTENT_TYPE, mime)
                    .body(Cow::Owned(bytes))
                    .unwrap()
            } else if let Some((mime, bytes)) = embedded_asset(path) {
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
