import { CONFIG } from "./config.js";

/**
 * handle test execution and measurements
 */
export class Benchmark {
	constructor(ui) {
		this.ui = ui;
		this.testResults = {};
		this.wasmModule = null; // cache WASM module, validated - because browser will cache binary but we need to cache initialized js module
		this.wasmModuleBlur = null;
		this.wasmModuleBatch = null;
		this.imageSizePerformance = this.loadImageSizeData();
	}

	/**
	 * runs both JS and WASM tests, with amount of runs based in config
	 */
	async runComparison(testType, imageData, runs, colorCount = 256) {
		const jsMetricsArray = [];
		const wasmMetricsArray = [];

		// JavaScript Test
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

		// WebAssembly Test
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

		const jsStats = this.calculateStatistics(jsMetricsArray);
		const wasmStats = this.calculateStatistics(wasmMetricsArray);

		// we need to do that because we cleared processedImageData earlier to save memory
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

		const megapixels = (imageData.width * imageData.height) / 1_000_000;
		this.recordImageSizePerformance(
			testType,
			megapixels,
			jsStats.median.executionTime,
			wasmStats.median.executionTime
		);

		if (imageData.formatInfo) {
			this.recordFormatPerformance(
				testType,
				imageData.formatInfo,
				megapixels,
				jsStats.median.executionTime,
				wasmStats.median.executionTime
			);
		}

		// using median to determine winner
		const jsFaster = jsStats.median.executionTime < wasmStats.median.executionTime;
		const timeDiff = Math.abs(jsStats.median.executionTime - wasmStats.median.executionTime);

		const speedup = jsFaster
			? wasmStats.median.executionTime / jsStats.median.executionTime
			: jsStats.median.executionTime / wasmStats.median.executionTime;

		if (jsFaster) {
			// just show who is first
			await this.displayResultWithDelay(testType, "js", jsStats.median, "winner");
			await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
			await this.displayResultWithDelay(testType, "wasm", wasmStats.median, "slower");
		} else {
			await this.displayResultWithDelay(testType, "wasm", wasmStats.median, "winner");
			await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
			await this.displayResultWithDelay(testType, "js", jsStats.median, "slower");
		}

		await this.delay(CONFIG.TIMING.RESULT_DISPLAY_DELAY);
		this.ui.hideCountdown(testType, "js");
		this.ui.hideCountdown(testType, "wasm");

		this.storeResults(testType, "js", jsStats);
		this.storeResults(testType, "wasm", wasmStats);

		// clear arrays for g.c.
		jsMetricsArray.length = 0;
		wasmMetricsArray.length = 0;

		this.ui.showSpeedupSummary(testType, jsFaster ? "js" : "wasm", speedup);
	}

	loadImageSizeData() {
		const stored = localStorage.getItem("imageSizePerformance");
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch (e) {
				console.warn("Failed to load image size data:", e);
			}
		}
		return {
			invert: [],
			batch: [],
			blur: [],
		};
	}

	saveImageSizeData() {
		try {
			// only keep recent entries to avoid localStorage freezing
			Object.keys(this.imageSizePerformance).forEach((testType) => {
				if (
					this.imageSizePerformance[testType].length > CONFIG.IMAGE_SIZE_TRACKING.MAX_SIZE_ENTRIES
				) {
					this.imageSizePerformance[testType] = this.imageSizePerformance[testType].slice(
						-CONFIG.IMAGE_SIZE_TRACKING.MAX_SIZE_ENTRIES
					);
				}
			});
			localStorage.setItem("imageSizePerformance", JSON.stringify(this.imageSizePerformance));
		} catch (e) {
			console.warn("Failed to save image size data:", e);
		}
	}

	recordImageSizePerformance(testType, megapixels, jsMedianTime, wasmMedianTime) {
		if (!CONFIG.IMAGE_SIZE_TRACKING.ENABLED) return;

		const speedup = jsMedianTime / wasmMedianTime; // > 1 = WASM , < 1 = JS

		if (!this.imageSizePerformance[testType]) {
			this.imageSizePerformance[testType] = [];
		}

		// check if similar size exists
		const existingIndex = this.imageSizePerformance[testType].findIndex(
			(entry) => Math.abs(entry.megapixels - megapixels) / megapixels < 0.05
		);

		const newEntry = {
			megapixels,
			jsTime: jsMedianTime,
			wasmTime: wasmMedianTime,
			speedup,
			timestamp: Date.now(),
		};

		if (existingIndex >= 0) {
			const existing = this.imageSizePerformance[testType][existingIndex];
			if (Math.abs(speedup) > Math.abs(existing.speedup)) {
				this.imageSizePerformance[testType][existingIndex] = newEntry;
			}
		} else {
			this.imageSizePerformance[testType].push(newEntry);
		}

		this.saveImageSizeData();
	}

	/**
	 * show results with small delay to have a feeling who is the winner
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

		const executionTime = endTime - startTime;

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
			formatInfo: imageData.formatInfo,
		};
	}

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

	calculateStatistics(metricsArray) {
		if (metricsArray.length === 0) {
			throw new Error("Cannot calculate statistics on empty array");
		}

		const sorted = [...metricsArray].sort((a, b) => a.executionTime - b.executionTime);

		const median = sorted[Math.floor(sorted.length / 2)];

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

		const squaredDiffs = metricsArray.reduce(
			(acc, m) => acc + Math.pow(m.executionTime - mean.executionTime, 2),
			0
		);
		const stdDev = Math.sqrt(squaredDiffs / count);

		const coefficientOfVariation = (stdDev / mean.executionTime) * 100;

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
	 * put results in memory and sessionStorage
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

		// need to clear previous runs to save space
		if (results.length > 1 && currentRun.js && currentRun.wasm) {
			const previousRun = results[results.length - 2];
			if (previousRun?.js?.median?.processedImageData) {
				previousRun.js.median.processedImageData = null;
			}
			if (previousRun?.wasm?.median?.processedImageData) {
				previousRun.wasm.median.processedImageData = null;
			}
		}

		currentRun[processorType] = statistics;

		const stored = sessionStorage.getItem(`${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`);
		let storedResults = stored ? JSON.parse(stored) : [];
		let storedRun = storedResults[storedResults.length - 1];

		if (!storedRun || (storedRun.js && storedRun.wasm)) {
			storedRun = {};
			storedResults.push(storedRun);
		}

		storedRun[processorType] = {
			median: this.sanitizeMetrics(statistics.median),
			mean: statistics.mean,
			stdDev: statistics.stdDev,
			min: this.sanitizeMetrics(statistics.min),
			max: this.sanitizeMetrics(statistics.max),
			count: statistics.count,
			firstRun: this.sanitizeMetrics(statistics.firstRun),
		};

		// store only last N runs
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

	sanitizeMetrics(metrics) {
		const { processedImageData, ...rest } = metrics;
		return rest; // keep everything except processedImageData
	}

	/**
	 * verify that js and wasm results are pixel identical
	 */
	async verifyResults(testType) {
		console.log(`Verifying results for ${testType}`);

		const results = this.testResults[testType];
		if (!results || results.length === 0) return false;

		const lastRun = results[results.length - 1];

		if (!lastRun?.js?.median?.processedImageData || !lastRun?.wasm?.median?.processedImageData) {
			return false;
		}

		const jsData = lastRun.js.median.processedImageData.data;
		const wasmData = lastRun.wasm.median.processedImageData.data;

		if (jsData.length !== wasmData.length) {
			console.error("Result length mismatch");
			return false;
		}

		// compare with threshold
		const threshold = CONFIG.VERIFICATION.PIXEL_DIFF_THRESHOLD;
		for (let i = 0; i < jsData.length; i++) {
			if (Math.abs(jsData[i] - wasmData[i]) > threshold) {
				console.error(`Pixel difference at index ${i}: JS=${jsData[i]}, WASM=${wasmData[i]}`);
				return false;
			}
		}

		return true;
	}

	delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
