export class EdgeDetector {
	static detectEdges(imageData) {
		const blurred = this.blur(imageData);
		const { width, height, data } = blurred;
		const output = new Uint8ClampedArray(data.length);

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

		const THRESH = 170; // tune 80–180 depending on result

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				let gx = 0;
				let gy = 0;

				for (let ky = 0; ky < 3; ky++) {
					for (let kx = 0; kx < 3; kx++) {
						const px = x + kx - 1;
						const py = y + ky - 1;
						const idx = (py * width + px) * 4;

						const gray = data[idx]; // already grayscale from blur
						gx += gray * sobelX[ky][kx];
						gy += gray * sobelY[ky][kx];
					}
				}

				const magnitude = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy)));
				const edge = magnitude > THRESH ? 255 : 0;

				const idx = (y * width + x) * 4;
				output[idx] = edge;
				output[idx + 1] = edge;
				output[idx + 2] = edge;
				output[idx + 3] = 255;
			}
		}

		return new ImageData(output, width, height);
	}

	static blur(imageData) {
		const { width, height, data } = imageData;
		const out = new Uint8ClampedArray(data.length);

		const kernel = [
			[1, 2, 1],
			[2, 4, 2],
			[1, 2, 1],
		];
		const sumK = 16;

		for (let y = 1; y < height - 1; y++) {
			for (let x = 1; x < width - 1; x++) {
				let acc = 0;

				for (let ky = 0; ky < 3; ky++) {
					for (let kx = 0; kx < 3; kx++) {
						const px = x + kx - 1;
						const py = y + ky - 1;
						const idx = (py * width + px) * 4;
						const gray = Math.round((data[idx] + data[idx + 1] + data[idx + 2]) / 3);
						acc += gray * kernel[ky][kx];
					}
				}

				const g = Math.round(acc / sumK);
				const idx = (y * width + x) * 4;
				out[idx] = out[idx + 1] = out[idx + 2] = g;
				out[idx + 3] = 255;
			}
		}

		return new ImageData(out, width, height);
	}
}
