use wasm_bindgen::prelude::*;
use web_sys::ImageData;

#[wasm_bindgen]
pub fn invert_colors(image_data: ImageData) -> Result<ImageData, JsValue> {
    // Get the pixel data
    let mut data = image_data.data().0;
    
    // Iterate through pixels (RGBA format: 4 bytes per pixel)
    for i in (0..data.len()).step_by(4) {
        data[i] = 255 - data[i];         // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
        // data[i + 3] is Alpha - left as is, the same thing as in js 
    }
    
    // new ImageData with processed pixels
    ImageData::new_with_u8_clamped_array_and_sh(
        wasm_bindgen::Clamped(&data),
        image_data.width(),
        image_data.height(),
    )
}