use wasm_bindgen::prelude::*;
use web_sys::ImageData;

#[wasm_bindgen]
pub fn edge_detection(image_data: ImageData) -> Result<ImageData, JsValue> {
    let data = image_data.data().0;
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let mut output = vec![0u8; data.len()];
    
    // Sobel kernels
    let sobel_x: [[i32; 3]; 3] = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    let sobel_y: [[i32; 3]; 3] = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    // Convert to grayscale and apply Sobel operator
    for y in 1..height-1 {
        for x in 1..width-1 {
            let mut gx = 0i32;
            let mut gy = 0i32;
            
            // Apply kernels
            for ky in 0..3 {
                for kx in 0..3 {
                    let px = x + kx - 1;
                    let py = y + ky - 1;
                    let idx = (py * width + px) * 4;
                    
                    // Grayscale value (match JS exactly)
                    let gray = ((data[idx] as i32 + data[idx + 1] as i32 + data[idx + 2] as i32) as f64 / 3.0).round() as i32;
                    
                    gx += gray * sobel_x[ky][kx];
                    gy += gray * sobel_y[ky][kx];
                }
            }
            
            // Calculate gradient magnitude (match JS rounding)
            let magnitude = ((gx * gx + gy * gy) as f64).sqrt().round().min(255.0).max(0.0) as u8;
            
            let idx = (y * width + x) * 4;
            output[idx] = magnitude;
            output[idx + 1] = magnitude;
            output[idx + 2] = magnitude;
            output[idx + 3] = data[idx + 3]; // Keep original alpha
        }
    }
    
    ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(&output),
        width as u32,
        height as u32,
    )
}