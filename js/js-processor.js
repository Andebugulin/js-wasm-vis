// js-processor.js
export class JSProcessor {
    /**
     * Inverts colors of an image
     * @param {ImageData} imageData - Canvas ImageData object
     * @returns {ImageData} - Processed ImageData
     */
    static invertColors(imageData) {
        const data = imageData.data;
        
        // Iterate through each pixel (4 values per pixel: R, G, B, A)
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];         // Red
            data[i + 1] = 255 - data[i + 1]; // Green
            data[i + 2] = 255 - data[i + 2]; // Blue
            // data[i + 3] is Alpha - unchanged, left as is
        }
        
        return imageData;
    }
}