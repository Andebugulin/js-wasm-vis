import { CONFIG } from "./config.js";

/**
 * Benchmarks
 */
export class Benchmark {
	constructor(ui) {
		this.ui = ui;
		this.testResults = {};
		this.wasmModule = null; // Cache WASM module, validated - because browser will cache binary but we need to cache initialized js module
		this.wasmModuleBlur = null;
		this.wasmModuleBatch = null;
	}

	/**
	 * Run complete comparison
	 */
	async runComparison(testType, imageData, runs, colorCount = 256) {
		const jsMetricsArray = [];
		const wasmMetricsArray = [];

		// === JavaScript Test ===
		this.ui.showCountdown(testType, "js", "preparing...");
		await this.delay(CONFIG.TIMING.COUNTDOWN_DELAY);

		for (let i = 0; i < runs; i++) {
			this.ui.showCountdown(testType, "js", `${i + 1}/${runs} runs`);
			const imageCopy = new ImageData(
				new Uint8ClampedArray(imageData.data),
				imageData.width,
				imageData.height
			);
			const metrics = await this.measurePerformance(testType, "js", imageCopy, i === 0, colorCount);
			jsMetricsArray.push(metrics);

			metrics.processedImageData = null;

			await this.delay(CONFIG.TIMING.DELAY_BETWEEN_RUNS);
		}

		// === WebAssembly Test ===
		this.ui.showCountdown(testType, "wasm", "preparing...");
		await this.delay(CONFIG.TIMING.COUNTDOWN_DELAY);

		for (let i = 0; i < runs; i++) {
			this.ui.showCountdown(testType, "wasm", `${i + 1}/${runs} runs`);
			const imageCopy = new ImageData(
				new Uint8ClampedArray(imageData.data),
				imageData.width,
				imageData.height
			);
			const metrics = await this.measurePerformance(
				testType,
				"wasm",
				imageCopy,
				i === 0,
				colorCount
			);
			wasmMetricsArray.push(metrics);

			metrics.processedImageData = null;

			await this.delay(CONFIG.TIMING.DELAY_BETWEEN_RUNS);
		}

		// Calculate statistics
		const jsStats = this.calculateStatistics(jsMetricsArray);
		const wasmStats = this.calculateStatistics(wasmMetricsArray);

		// We need to do that because we cleared processedImageData earlier to save memory
		console.log("Regenerating median results for display...");
		const jsMedianCopy = new ImageData(
			new Uint8ClampedArray(imageData.data),
			imageData.width,
			imageData.height
		);
		jsStats.median.processedImageData = await this.executeTest(
			testType,
			"js",
			jsMedianCopy,
			colorCount
		);

		const wasmMedianCopy = new ImageData(
			new Uint8ClampedArray(imageData.data),
			imageData.width,
			imageData.height
		);
		wasmStats.median.processedImageData = await this.executeTest(
			testType,
			"wasm",
			wasmMedianCopy,
			colorCount
		);

		// REVIEW: why don't just calculate it not from media, but from all runs?
		// Determine winner based on median execution time
		const jsFaster = jsStats.median.executionTime < wasmStats.median.executionTime;
		const timeDiff = Math.abs(jsStats.median.executionTime - wasmStats.median.executionTime);

		// Calculate speedup factor
		const speedup = jsFaster
			? wasmStats.median.executionTime / jsStats.median.executionTime
			: jsStats.median.executionTime / wasmStats.median.executionTime;

		// Display results in order with visual delay
		if (jsFaster) {
			await this.displayResultWithDelay(testType, "js", jsStats.median, "winner");
			await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
			await this.displayResultWithDelay(testType, "wasm", wasmStats.median, "slower");
		} else {
			await this.displayResultWithDelay(testType, "wasm", wasmStats.median, "winner");
			await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
			await this.displayResultWithDelay(testType, "js", jsStats.median, "slower");
		}

		// Clean up countdowns
		await this.delay(CONFIG.TIMING.RESULT_DISPLAY_DELAY);
		this.ui.hideCountdown(testType, "js");
		this.ui.hideCountdown(testType, "wasm");

		// Store results with statistics
		this.storeResults(testType, "js", jsStats);
		this.storeResults(testType, "wasm", wasmStats);

		// Force garbage collection hint by clearing intermediate arrays
		jsMetricsArray.length = 0;
		wasmMetricsArray.length = 0;

		// Display speedup summary
		this.ui.showSpeedupSummary(testType, jsFaster ? "js" : "wasm", speedup);
	}

	/**
	 * Display result with status indicator, basically ui operation with delay for visual effect, so that the user knows that tests started to run
	 */
	async displayResultWithDelay(testType, side, metrics, status) {
		const statusText = status === "winner" ? "completed 1" : "completed 2";
		this.ui.showCountdown(testType, side, statusText);
		this.ui.displayResult(testType, side, metrics.processedImageData);
		await this.delay(CONFIG.TIMING.MIN_VISUAL_DELAY);
	}
	async measurePerformance(
		testType,
		processorType,
		imageData,
		isFirstRun = false,
		colorCount = 256
	) {
		const startTime = performance.now();
		const processedImageData = await this.executeTest(
			testType,
			processorType,
			imageData,
			colorCount
		);
		const endTime = performance.now();

		// Calculate execution time
		const executionTime = endTime - startTime;

		// Calculate throughput (megapixels per second)
		const totalPixels = imageData.width * imageData.height;
		const megapixels = totalPixels / 1_000_000;
		const throughput = megapixels / (executionTime / 1000);

		return {
			executionTime,
			throughput,
			processedImageData,
			isFirstRun,
			imageSize: {
				width: imageData.width,
				height: imageData.height,
				megapixels,
			},
		};
	}

	/**
	 * Execute the actual image processing test
	 */
	async executeTest(testType, processorType, imageData, colorCount = 256) {
		if (testType === "invert") {
			if (processorType === "js") {
				const module = await import("./js-processor.js");
				return module.JSProcessor.invertColors(imageData);
			} else {
				if (!this.wasmModule) {
					this.wasmModule = await import("../wasm/test1/wasm-build-test1/wasm_src_test1.js");
					await this.wasmModule.default();
				}
				return this.wasmModule.invert_colors(imageData);
			}
		}

		if (testType === "blur") {
			if (processorType === "js") {
				const module = await import("./js-processor-blur.js");

				return module.KMeansQuantizer.quantize(imageData, colorCount);
			} else {
				if (!this.wasmModuleBlur) {
					this.wasmModuleBlur = await import("../wasm/test2/wasm-build-test2/wasm_src_test2.js");
					await this.wasmModuleBlur.default();
				}

				return this.wasmModuleBlur.quantize(imageData, colorCount);
			}
		}

		if (testType === "batch") {
			if (processorType === "js") {
				const module = await import("./js-processor-edge.js");
				return module.EdgeDetector.detectEdges(imageData);
			} else {
				if (!this.wasmModuleBatch) {
					this.wasmModuleBatch = await import("../wasm/test3/wasm-build-test3/wasm_src_test3.js");
					await this.wasmModuleBatch.default();
				}
				return this.wasmModuleBatch.edge_detection(imageData);
			}
		}

		throw new Error(`Test type "${testType}" not implemented`);
	}

	/**
	 * Calculate statistics from metrics array
	 */
	calculateStatistics(metricsArray) {
		if (metricsArray.length === 0) {
			throw new Error("Cannot calculate statistics on empty array");
		}

		// Sort by execution time for median
		const sorted = [...metricsArray].sort((a, b) => a.executionTime - b.executionTime);

		const median = sorted[Math.floor(sorted.length / 2)];

		// Calculate mean
		const sum = metricsArray.reduce(
			(acc, m) => ({
				executionTime: acc.executionTime + m.executionTime,
				throughput: acc.throughput + m.throughput,
			}),
			{
				executionTime: 0,
				throughput: 0,
			}
		);

		const count = metricsArray.length;
		const mean = {
			executionTime: sum.executionTime / count,
			throughput: sum.throughput / count,
		};

		// Calculate standard deviation (must be AFTER mean is calculated)
		const squaredDiffs = metricsArray.reduce(
			(acc, m) => acc + Math.pow(m.executionTime - mean.executionTime, 2),
			0
		);
		const stdDev = Math.sqrt(squaredDiffs / count);

		// Calculate coefficient of variation (must be AFTER stdDev)
		const coefficientOfVariation = (stdDev / mean.executionTime) * 100;

		// Find min and max
		const min = sorted[0];
		const max = sorted[sorted.length - 1];

		const firstRun = metricsArray.find((m) => m.isFirstRun);

		return {
			median,
			mean,
			stdDev,
			coefficientOfVariation,
			min,
			max,
			count,
			firstRun,
			allRuns: metricsArray,
		};
	}

	/**
	 * Store results in memory and sessionStorage
	 */
	storeResults(testType, processorType, statistics) {
		if (!this.testResults[testType]) {
			this.testResults[testType] = [];
		}

		let results = this.testResults[testType];
		let currentRun = results[results.length - 1];

		if (!currentRun || (currentRun.js && currentRun.wasm)) {
			currentRun = {};
			results.push(currentRun);
		}

		// **Clear the previous complete run's images before storing new ones**
		if (results.length > 1 && currentRun.js && currentRun.wasm) {
			const previousRun = results[results.length - 2];
			if (previousRun?.js?.median?.processedImageData) {
				previousRun.js.median.processedImageData = null;
			}
			if (previousRun?.wasm?.median?.processedImageData) {
				previousRun.wasm.median.processedImageData = null;
			}
		}

		// Store new statistics
		currentRun[processorType] = statistics;

		// Store limited data in sessionStorage (no ImageData)
		const stored = sessionStorage.getItem(`${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`);
		let storedResults = stored ? JSON.parse(stored) : [];
		let storedRun = storedResults[storedResults.length - 1];

		if (!storedRun || (storedRun.js && storedRun.wasm)) {
			storedRun = {};
			storedResults.push(storedRun);
		}

		// Store only serializable metrics (no ImageData, no functions)
		storedRun[processorType] = {
			median: this.sanitizeMetrics(statistics.median),
			mean: statistics.mean,
			stdDev: statistics.stdDev,
			min: this.sanitizeMetrics(statistics.min),
			max: this.sanitizeMetrics(statistics.max),
			count: statistics.count,
			firstRun: this.sanitizeMetrics(statistics.firstRun),
		};

		// Keep only last N results
		if (storedResults.length > CONFIG.STORAGE.MAX_HISTORY_ITEMS) {
			storedResults = storedResults.slice(-CONFIG.STORAGE.MAX_HISTORY_ITEMS);
		}
		if (results.length > CONFIG.STORAGE.MAX_HISTORY_ITEMS) {
			this.testResults[testType] = results.slice(-CONFIG.STORAGE.MAX_HISTORY_ITEMS);
		}

		sessionStorage.setItem(
			`${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`,
			JSON.stringify(storedResults)
		);
	}

	/**
	 * Remove non-serializable properties from metrics
	 */
	sanitizeMetrics(metrics) {
		const { processedImageData, ...rest } = metrics;
		return rest; // Keep everything except processedImageData
	}

	/**
	 * Verify that JS and WASM produced identical results
	 */
	async verifyResults(testType) {
		console.log(`Verifying results for ${testType}`);

		const results = this.testResults[testType];
		if (!results || results.length === 0) return false;

		const lastRun = results[results.length - 1];

		// Check if both results exist
		if (!lastRun?.js?.median?.processedImageData || !lastRun?.wasm?.median?.processedImageData) {
			return false;
		}

		const jsData = lastRun.js.median.processedImageData.data;
		const wasmData = lastRun.wasm.median.processedImageData.data;

		if (jsData.length !== wasmData.length) {
			console.error("Result length mismatch");
			return false;
		}

		// Compare with threshold
		const threshold = CONFIG.VERIFICATION.PIXEL_DIFF_THRESHOLD;
		for (let i = 0; i < jsData.length; i++) {
			if (Math.abs(jsData[i] - wasmData[i]) > threshold) {
				console.error(`Pixel difference at index ${i}: JS=${jsData[i]}, WASM=${wasmData[i]}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Utility delay function
	 */
	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
