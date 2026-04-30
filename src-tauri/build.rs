fn main() {
  #[cfg(target_os = "windows")]
  {
    // 中文注释：在构建阶段把 `icons/CL.png` 自动生成成符合 Windows 资源编译要求的 ICO 3.00，
    // 覆盖 `icons/icon.ico`。避免手动生成在不同环境下输出格式不兼容（例如 RC2175）。
    if let Err(e) = generate_windows_ico_300_from_cl_png() {
      eprintln!("[build][icon] 生成 icon.ico 失败：{e}");
    }
  }

  tauri_build::build()
}

#[cfg(target_os = "windows")]
fn generate_windows_ico_300_from_cl_png() -> Result<(), Box<dyn std::error::Error>> {
  use std::fs;
  use std::path::Path;

  let icons_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("icons");
  let src_png = icons_dir.join("CL.png");
  let dst_ico = icons_dir.join("icon.ico");

  if !src_png.exists() {
    return Ok(());
  }

  // 中文注释：避免 `tauri dev` 的监听模式下反复触发重编译。
  // 只有当 `CL.png` 的更新时间 >= `icon.ico` 时，才重新生成图标。
  if let (Ok(src_meta), Ok(dst_meta)) = (fs::metadata(&src_png), fs::metadata(&dst_ico)) {
    if let (Ok(src_m), Ok(dst_m)) = (src_meta.modified(), dst_meta.modified()) {
      if dst_m >= src_m {
        return Ok(());
      }
    }
  }

  let file = fs::File::open(&src_png)?;
  let mut decoder = png::Decoder::new(file);
  // 中文注释：尽量把解码输出规范化到 8bit RGBA，便于后续缩放与再编码。
  // - EXPAND：展开调色板/灰度到彩色（并补齐 alpha）
  // - ALPHA：确保包含 alpha 通道
  // - STRIP_16：截断 16-bit 到 8-bit
  decoder.set_transformations(
    png::Transformations::EXPAND | png::Transformations::ALPHA | png::Transformations::STRIP_16,
  );
  let mut reader = decoder.read_info()?;

  let src_w = reader.info().width as usize;
  let src_h = reader.info().height as usize;
  let scale_w = 256usize;
  let scale_h = 256usize;
  let src_bpp = reader.info().bytes_per_pixel();

  let mut buf = vec![0u8; reader.output_buffer_size()];
  reader.next_frame(&mut buf)?;

  // 中文注释：最近邻缩放到 256x256（ICO 3.00 目录宽高=0 表示 256）。
  let mut rgba_256 = vec![0u8; scale_w * scale_h * 4];
  for y in 0..scale_h {
    for x in 0..scale_w {
      let sx = x * src_w / scale_w;
      let sy = y * src_h / scale_h;
      let src_i = (sy * src_w + sx) * src_bpp;
      let dst_i = (y * scale_w + x) * 4;
      match src_bpp {
        4 => rgba_256[dst_i..dst_i + 4].copy_from_slice(&buf[src_i..src_i + 4]),
        3 => {
          rgba_256[dst_i] = buf[src_i];
          rgba_256[dst_i + 1] = buf[src_i + 1];
          rgba_256[dst_i + 2] = buf[src_i + 2];
          rgba_256[dst_i + 3] = 255;
        }
        _ => {
          // 中文注释：兜底处理，避免 build 直接失败。
          rgba_256[dst_i] = 0;
          rgba_256[dst_i + 1] = 0;
          rgba_256[dst_i + 2] = 0;
          rgba_256[dst_i + 3] = 255;
        }
      }
    }
  }

  // 中文注释：把缩放后的 RGBA 写成 PNG 字节流，然后作为 ICO 3.00 的 PNG frame 嵌入。
  let mut png_bytes: Vec<u8> = Vec::new();
  let mut png_encoder = png::Encoder::new(&mut png_bytes, scale_w as u32, scale_h as u32);
  png_encoder.set_color(png::ColorType::Rgba);
  png_encoder.set_depth(png::BitDepth::Eight);
  let mut writer = png_encoder.write_header()?;
  writer.write_image_data(&rgba_256)?;
  writer.finish()?;

  // 中文注释：构造单帧 ICO 3.00（宽高=0 => 256）。
  // 文件头: reserved(2) + type(2) + count(2)
  let mut ico: Vec<u8> = Vec::new();
  ico.extend_from_slice(&[0u8, 0u8]); // reserved
  ico.extend_from_slice(&[1u8, 0u8]); // type = 1 (icon)
  ico.extend_from_slice(&[1u8, 0u8]); // count = 1

  // 目录项 16 字节
  ico.push(0); // width (0 => 256)
  ico.push(0); // height (0 => 256)
  ico.push(0); // color count
  ico.push(0); // reserved
  ico.extend_from_slice(&1u16.to_le_bytes()); // planes
  ico.extend_from_slice(&32u16.to_le_bytes()); // bit count
  ico.extend_from_slice(&(png_bytes.len() as u32).to_le_bytes()); // bytes_in_res
  ico.extend_from_slice(&22u32.to_le_bytes()); // image_offset (6 + 16)

  // PNG frame 数据
  ico.extend_from_slice(&png_bytes);

  fs::write(dst_ico, ico)?;
  Ok(())
}
