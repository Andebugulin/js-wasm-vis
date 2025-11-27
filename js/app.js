import { UI } from "./ui.js";
import { Benchmark } from "./benchmark.js";
import { ImageUtils } from "./utils.js";
import { CONFIG } from "./config.js";
import { SettingsManager } from "./settings.js";

/**
 * main app controller
 */
class App {
	constructor() {
		this.ui = new UI();
		this.benchmark = new Benchmark(this.ui);
		this.currentImages = {};
		this.settings = new SettingsManager(this);
		// for charts
		window.benchmarkInstance = this.benchmark;

		this.init();
	}

	init() {
		console.log("WebAssembly vs JavaScript Benchmark initialized");
		console.log("Configuration:", CONFIG);
		this.setupEventListeners();
	}

	/**
	 * setup all even handlers
	 */
	setupEventListeners() {
		// upload button listeners
		document.querySelectorAll(".upload-button").forEach((button) => {
			button.addEventListener("click", (e) => {
				const testType = e.target.dataset.test;
				document.querySelector(`.hidden-file-input[data-test="${testType}"]`).click();
			});
		});

		// file input listeners
		document.querySelectorAll(".hidden-file-input").forEach((input) => {
			input.addEventListener("change", (e) => this.handleFileUpload(e));
		});

		// run test button listeners
		document.querySelectorAll(".run-test-button").forEach((button) => {
			button.addEventListener("click", (e) => this.handleRunTest(e));
		});

		// metric tab listeners
		document.querySelectorAll(".metric-tab").forEach((tab) => {
			tab.addEventListener("click", (e) => this.handleMetricChange(e));
		});
	}

	/**
	 * handle image uploads
	 */
	async handleFileUpload(event) {
		console.log("File upload event:", event);
		const file = event.target.files[0];
		if (!file) return;

		const testType = event.target.dataset.test;

		if (!file.type.startsWith("image/")) {
			alert("Please upload a valid image file");
			return;
		}

		// limit file sizes
		const maxSize = 50 * 1024 * 1024;
		if (file.size > maxSize) {
			alert("File too large. Please upload an image smaller than 50MB");
			return;
		}

		try {
			const dataUrl = await this.readFileAsDataURL(file);

			// need to check dimensions before processing
			const tempImage = await ImageUtils.loadImage(dataUrl);

			const maxDimension = CONFIG.RUNS[testType.toUpperCase()].MAX_DIMENSION;

			if (tempImage.width > maxDimension || tempImage.height > maxDimension) {
				alert(
					`Image dimensions too large for this test!\nMaximum allowed: ${maxDimension}x${maxDimension} pixels\nYour image: ${tempImage.width}x${tempImage.height} pixels`
				);
				return;
			}

			const imageHash = await this.generateImageHash(dataUrl);

			this.currentImages[testType] = {
				data: dataUrl,
				hash: imageHash,
				filename: file.name,
				size: file.size,
				dimensions: { width: tempImage.width, height: tempImage.height },
				isVideo: false,
			};

			await this.ui.showImagePreview(testType, dataUrl);

			this.ui.enableRunButton(testType); // allow test to run now
		} catch (error) {
			console.error("File upload failed:", error);
			alert("Failed to load file. Please try another image.");
		}
	}

	/**
	 * quick hash to verify that its the same image across runs
	 */
	async generateImageHash(dataUrl) {
		const img = await ImageUtils.loadImage(dataUrl);
		let hash = 0;
		for (let i = 0; i < Math.min(400, img.data.length); i++) {
			hash = (hash << 5) - hash + img.data[i];
			hash = hash & hash;
		}
		return hash.toString(16);
	}

	async handleRunTest(event) {
		const testType = event.target.dataset.test;

		this.ui.setButtonRunning(testType, true);

		try {
			const imageInfo = this.currentImages[testType];
			const imageData = await ImageUtils.loadImage(imageInfo.data);

			imageData.hash = imageInfo.hash; // for tracking across runs
			imageData.filename = imageInfo.filename;

			const runs = this.getRunCount(imageData, testType);

			let colorCount = CONFIG.KMEANS.DEFAULT_COLORS;
			if (testType === "blur") {
				const colorInput = document.getElementById("color-count-blur");
				colorCount = Math.max(
					CONFIG.KMEANS.MIN_COLORS,
					Math.min(
						CONFIG.KMEANS.MAX_COLORS,
						parseInt(colorInput.value) || CONFIG.KMEANS.DEFAULT_COLORS
					)
				);
			}

			console.log(`Running ${runs} iterations for ${testType}`);
			console.log(
				`Image size: ${imageData.width}x${imageData.height} (${(
					(imageData.width * imageData.height) /
					1_000_000
				).toFixed(2)} MP)`
			);
			if (testType === "blur") {
				console.log(`Color count: ${colorCount}`);
			}

			// run both tests
			await this.benchmark.runComparison(testType, imageData, runs, colorCount);

			const defaultMetric = testType === "invert" ? "time" : "time"; // start with time view
			this.ui.updateChart(testType, defaultMetric);
			this.ui.setActiveMetricTab(testType, defaultMetric);

			const isIdentical = await this.benchmark.verifyResults(testType);
			this.ui.showVerificationBadge(testType, isIdentical);

			if (!isIdentical) {
				console.warn("JS and WASM results differ! This may indicate a bug.");
			}
		} catch (error) {
			console.error("Test failed:", error);
			this.ui.showError(testType, error.message || "Test execution failed");
		} finally {
			this.ui.setButtonRunning(testType, false);
		}
	}

	/**
	 * switch between between metrics
	 */
	handleMetricChange(event) {
		const tab = event.target;
		const testItem = tab.closest(".test-item");
		const testType = testItem.dataset.test;
		const metric = tab.dataset.metric;

		testItem.querySelectorAll(".metric-tab").forEach((t) => t.classList.remove("active"));
		tab.classList.add("active");

		this.ui.updateChart(testType, metric);
	}

	/**
	 * check config for defining number of runs
	 */
	getRunCount(imageData, testType) {
		const megapixels = (imageData.width * imageData.height) / 1_000_000;
		const testConfig = CONFIG.RUNS[testType.toUpperCase()];

		if (megapixels < testConfig.SMALL_IMAGE_THRESHOLD) {
			return testConfig.SMALL_IMAGE_RUNS;
		}
		if (megapixels < testConfig.MEDIUM_IMAGE_THRESHOLD) {
			return testConfig.MEDIUM_IMAGE_RUNS;
		}
		return testConfig.LARGE_IMAGE_RUNS;
	}

	readFileAsDataURL(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsDataURL(file);
		});
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		try {
			new App();
		} catch (error) {
			console.error("Application initialization failed:", error);
			alert("Failed to initialize application. Please check console for details.");
		}
	});
} else {
	new App();
}
