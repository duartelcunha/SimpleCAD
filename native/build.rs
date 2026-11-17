fn main() {
    if std::env::var_os("CARGO_CFG_WINDOWS").is_some() {
        println!("cargo:rerun-if-changed=../icon.ico");
        let mut res = tauri_winres::WindowsResource::new();
        res.set_icon("../icon.ico")
            .set("ProductName", "SimpleCAD")
            .set(
                "FileDescription",
                "SimpleCAD — 2D & 3D Architectural Floorplan Studio",
            )
            .set("CompanyName", "SimpleCAD")
            .set("LegalCopyright", "SimpleCAD")
            .set("OriginalFilename", "SimpleCAD.exe");
        res.compile().expect("failed to compile Windows resource");
    }
}
