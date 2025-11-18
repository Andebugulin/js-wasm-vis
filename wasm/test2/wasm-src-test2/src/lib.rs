use wasm_bindgen::prelude::*;
use web_sys::ImageData;

/// K-Means Color Quantization Implementation in Rust/WASM
/// Deterministic K-Means++ initialization for better color diversity
#[wasm_bindgen]
pub fn quantize(image_data: &ImageData, k: usize) -> Result<ImageData, JsValue> {
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();
    
    // Extract ALL pixels (RGB only)
    let mut pixels: Vec<[f64; 3]> = Vec::with_capacity(width * height);
    for i in (0..data.len()).step_by(4) {
        pixels.push([
            data[i] as f64,
            data[i + 1] as f64,
            data[i + 2] as f64,
        ]);
    }
    
    // IMPORTANT: Train K-Means on a SAMPLE for better color distribution
    let sample_size = 1000.min(pixels.len());
    let sampled_pixels = deterministic_sample(&pixels, sample_size);
    
    // Initialize centroids from SAMPLED pixels
    let mut centroids = initialize_centroids_deterministic(&sampled_pixels, k);
    
    // K-means iterations on SAMPLED pixels only
    let max_iterations = 20;
    for _ in 0..max_iterations {
        let mut clusters: Vec<Vec<[f64; 3]>> = vec![Vec::new(); k];
        
        for pixel in &sampled_pixels {
            let nearest = find_nearest_centroid(pixel, &centroids);
            clusters[nearest].push(*pixel);
        }
        
        let new_centroids: Vec<[f64; 3]> = clusters
            .iter()
            .enumerate()
            .map(|(i, cluster)| {
                if cluster.is_empty() {
                    centroids[i]
                } else {
                    calculate_mean(cluster)
                }
            })
            .collect();
        
        if centroids_converged(&centroids, &new_centroids, 1.0) {
            break;
        }
        centroids = new_centroids;
    }
    
    // Apply trained centroids to ALL pixels
    let mut output = vec![0u8; data.len()];
    for (i, pixel) in pixels.iter().enumerate() {
        let nearest = find_nearest_centroid(pixel, &centroids);
        let [r, g, b] = centroids[nearest];
        
        output[i * 4] = r.round() as u8;
        output[i * 4 + 1] = g.round() as u8;
        output[i * 4 + 2] = b.round() as u8;
        output[i * 4 + 3] = data[i * 4 + 3];
    }
    
    ImageData::new_with_u8_clamped_array(
        wasm_bindgen::Clamped(&output),
        width as u32,
    )
}

/// Deterministic sampling - picks evenly spaced pixels
fn deterministic_sample(pixels: &[[f64; 3]], sample_size: usize) -> Vec<[f64; 3]> {
    let mut sampled = Vec::with_capacity(sample_size);
    let step = pixels.len() as f64 / sample_size as f64;
    
    for i in 0..sample_size {
        let idx = (i as f64 * step).floor() as usize;
        sampled.push(pixels[idx]);
    }
    
    sampled
}

/// Deterministic initialization inspired by K-Means++
/// Spreads centroids across color space for better diversity
fn initialize_centroids_deterministic(pixels: &[[f64; 3]], k: usize) -> Vec<[f64; 3]> {
    if pixels.is_empty() {
        return Vec::new();
    }
    
    let mut centroids = Vec::with_capacity(k);
    
    // First centroid: use pixel at 1/4 position
    centroids.push(pixels[pixels.len() / 4]);
    
    // Remaining centroids: pick pixels furthest from existing centroids
    for _ in 1..k {
        let mut max_min_dist = -1.0;
        let mut best_pixel_idx = 0;
        
        // Sample every Nth pixel for performance (deterministic)
        let sample_rate = 1.max(pixels.len() / 1000);
        
        for i in (0..pixels.len()).step_by(sample_rate) {
            let pixel = &pixels[i];
            
            // Find distance to nearest existing centroid
            let mut min_dist = f64::INFINITY;
            for centroid in &centroids {
                let dist = euclidean_distance(pixel, centroid);
                if dist < min_dist {
                    min_dist = dist;
                }
            }
            
            // Keep track of pixel with maximum minimum distance
            if min_dist > max_min_dist {
                max_min_dist = min_dist;
                best_pixel_idx = i;
            }
        }
        
        centroids.push(pixels[best_pixel_idx]);
    }
    
    centroids
}

fn find_nearest_centroid(pixel: &[f64; 3], centroids: &[[f64; 3]]) -> usize {
    let mut min_dist = f64::INFINITY;
    let mut nearest = 0;
    
    for (i, centroid) in centroids.iter().enumerate() {
        let dist = euclidean_distance(pixel, centroid);
        if dist < min_dist {
            min_dist = dist;
            nearest = i;
        }
    }
    
    nearest
}

fn euclidean_distance(p1: &[f64; 3], p2: &[f64; 3]) -> f64 {
    let dr = p1[0] - p2[0];
    let dg = p1[1] - p2[1];
    let db = p1[2] - p2[2];
    (dr * dr + dg * dg + db * db).sqrt()
}

fn calculate_mean(cluster: &[[f64; 3]]) -> [f64; 3] {
    let len = cluster.len() as f64;
    let sum = cluster.iter().fold([0.0, 0.0, 0.0], |acc, pixel| {
        [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]]
    });
    
    [sum[0] / len, sum[1] / len, sum[2] / len]
}

fn centroids_converged(old: &[[f64; 3]], new: &[[f64; 3]], threshold: f64) -> bool {
    for (old_c, new_c) in old.iter().zip(new.iter()) {
        if euclidean_distance(old_c, new_c) > threshold {
            return false;
        }
    }
    true
}