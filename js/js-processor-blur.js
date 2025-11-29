export class KMeansQuantizer {
	static quantize(imageData, k = 8) {
		const { width, height, data } = imageData;
		const output = new Uint8ClampedArray(data.length);

		// only rgb needed
		const pixels = [];
		for (let i = 0; i < data.length; i += 4) {
			// use float becuase rust uses float
			pixels.push([data[i] * 1.0, data[i + 1] * 1.0, data[i + 2] * 1.0]);
		}

		// sample 1k ( too slow if more)
		const sampleSize = Math.min(1000, pixels.length);
		const sampledPixels = this.deterministicSample(pixels, sampleSize);

		let centroids = this.initializeCentroidsDeterministic(sampledPixels, k);

		const maxIterations = 20;
		for (let iter = 0; iter < maxIterations; iter++) {
			const clusters = Array.from({ length: k }, () => []);

			for (const pixel of sampledPixels) {
				const nearest = this.findNearestCentroid(pixel, centroids);
				clusters[nearest].push(pixel);
			}

			const newCentroids = clusters.map((cluster, i) => {
				if (cluster.length === 0) return centroids[i];
				return this.calculateMean(cluster);
			});

			if (this.centroidsConverged(centroids, newCentroids, 1.0)) break;
			centroids = newCentroids;
		}

		// map all pixels to nearest centroids
		for (let i = 0; i < pixels.length; i++) {
			const nearest = this.findNearestCentroid(pixels[i], centroids);
			const [r, g, b] = centroids[nearest];

			output[i * 4] = Math.round(r);
			output[i * 4 + 1] = Math.round(g);
			output[i * 4 + 2] = Math.round(b);
			output[i * 4 + 3] = data[i * 4 + 3];
		}

		return new ImageData(output, width, height);
	}

	static deterministicSample(pixels, sampleSize) {
		const sampled = [];
		const step = pixels.length / sampleSize;

		for (let i = 0; i < sampleSize; i++) {
			const idx = Math.floor(i * step);
			sampled.push([...pixels[idx]]);
		}

		return sampled;
	}

	/**
	 * spreads centroids out (kmeans++ way)
	 */
	static initializeCentroidsDeterministic(pixels, k) {
		if (pixels.length === 0) return [];

		const centroids = [];

		//  start at 1/4th position
		centroids.push([...pixels[Math.floor(pixels.length / 4)]]);

		// pick remaining centroids
		for (let c = 1; c < k; c++) {
			let maxMinDist = -1;
			let bestPixelIdx = 0;

			// don't check pixel one by one
			const sampleRate = Math.max(1, Math.floor(pixels.length / 1000));

			for (let i = 0; i < pixels.length; i += sampleRate) {
				const pixel = pixels[i];

				// find closest centroid
				let minDist = Infinity;
				for (const centroid of centroids) {
					const dist = this.euclideanDistance(pixel, centroid);
					if (dist < minDist) minDist = dist;
				}

				if (minDist > maxMinDist) {
					maxMinDist = minDist;
					bestPixelIdx = i;
				}
			}

			centroids.push([...pixels[bestPixelIdx]]);
		}

		return centroids;
	}

	static findNearestCentroid(pixel, centroids) {
		let minDist = Infinity;
		let nearest = 0;

		for (let i = 0; i < centroids.length; i++) {
			const dist = this.euclideanDistance(pixel, centroids[i]);
			if (dist < minDist) {
				minDist = dist;
				nearest = i;
			}
		}
		return nearest;
	}

	static euclideanDistance(p1, p2) {
		const dr = p1[0] - p2[0];
		const dg = p1[1] - p2[1];
		const db = p1[2] - p2[2];
		return Math.sqrt(dr * dr + dg * dg + db * db);
	}

	static calculateMean(cluster) {
		const sum = cluster.reduce(
			(acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]],
			[0, 0, 0]
		);
		const len = cluster.length;
		return [sum[0] / len, sum[1] / len, sum[2] / len];
	}

	static centroidsConverged(old, newC, threshold = 1.0) {
		for (let i = 0; i < old.length; i++) {
			if (this.euclideanDistance(old[i], newC[i]) > threshold) {
				return false;
			}
		}
		return true;
	}
}
