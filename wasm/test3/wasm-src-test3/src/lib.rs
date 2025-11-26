use wasm_bindgen::prelude::*;
use web_sys::ImageData;

#[wasm_bindgen]
pub fn edge_detection(image_data: ImageData) -> Result<ImageData, JsValue> {
    // First blur the image
    let blurred = blur(&image_data)?;
    let data = blurred.data().0;
    let width = blurred.width() as usize;
    let height = blurred.height() as usize;
    
    let mut output = vec![0u8; data.len()];
    
    let sobel_x: [[i32; 3]; 3] = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y: [[i32; 3]; 3] = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    let thresh = 170;
    
    for y in 1..height-1 {
        for x in 1..width-1 {
            let mut gx = 0i32;
            let mut gy = 0i32;
            
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = x + kx - 1;
                    let py = y + ky - 1;
                    let idx = (py * width + px) * 4;
                    let gray = data[idx] as i32; // already grayscale from blur
                    
                    gx += gray * sobel_x[ky][kx];
                    gy += gray * sobel_y[ky][kx];
                }
            }
            
            let magnitude = ((gx * gx + gy * gy) as f64).sqrt().round().min(255.0) as u8;
            let edge = if magnitude > thresh { 255 } else { 0 };
            
            let idx = (y * width + x) * 4;
            output[idx] = edge;
            output[idx + 1] = edge;
            output[idx + 2] = edge;
            output[idx + 3] = 255;
        }
    }
    
    ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(&output),
        width as u32,
        height as u32,
    )
}

fn blur(image_data: &ImageData) -> Result<ImageData, JsValue> {
    let data = image_data.data().0;
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let mut out = vec![0u8; data.len()];
    
    let kernel: [[i32; 3]; 3] = [[1, 2, 1], [2, 4, 2], [1, 2, 1]];
    let sum_k = 16;
    
    for y in 1..height-1 {
        for x in 1..width-1 {
            let mut acc = 0i32;
            
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = x + kx - 1;
                    let py = y + ky - 1;
                    let idx = (py * width + px) * 4;
                    let gray = ((data[idx] as i32 + data[idx + 1] as i32 + data[idx + 2] as i32) as f64 / 3.0).round() as i32;
                    acc += gray * kernel[ky][kx];
                }
            }
            
            let g = ((acc as f64 / sum_k as f64).round() as u8);
            let idx = (y * width + x) * 4;
            out[idx] = g;
            out[idx + 1] = g;
            out[idx + 2] = g;
            out[idx + 3] = 255;
        }
    }
    
    ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(&out),
        width as u32,
        height as u32,
    )
}