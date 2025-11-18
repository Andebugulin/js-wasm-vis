export class EdgeDetector {
	static detectEdges(imageData) {
		const { width, height, data } = imageData;
		const output = new Uint8ClampedArray(data.length);

		// Sobel kernels
		const sobelX = [
			[-1, 0, 1],
			[-2, 0, 2],
			[-1, 0, 1],
		];
		const sobelY = [
			[-1, -2, -1],
			[0, 0, 0],
			[1, 2, 1],
		];

		// Apply Sobel operator
		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				let gx = 0;
				let gy = 0;

				// Convolve with kernels
				for (let ky = 0; ky < 3; ky++) {
					for (let kx = 0; kx < 3; kx++) {
						const px = x + kx - 1;
						const py = y + ky - 1;
						const idx = (py * width + px) * 4;

						// Convert to grayscale (round to match Rust)
						const gray = Math.round((data[idx] + data[idx + 1] + data[idx + 2]) / 3);

						gx += gray * sobelX[ky][kx];
						gy += gray * sobelY[ky][kx];
					}
				}

				// Calculate gradient magnitude (clamp to 0-255)
				const magnitude = Math.min(255, Math.max(0, Math.round(Math.sqrt(gx * gx + gy * gy))));

				const idx = (y * width + x) * 4;
				output[idx] = magnitude;
				output[idx + 1] = magnitude;
				output[idx + 2] = magnitude;
				output[idx + 3] = data[idx + 3];
			}
		}

		return new ImageData(output, width, height);
	}
}
