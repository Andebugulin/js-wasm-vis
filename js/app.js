import { UI } from "./ui.js";
import { Benchmark } from "./benchmark.js";
import { ImageUtils } from "./utils.js";
import { CONFIG } from "./config.js";
import { SettingsManager } from "./settings.js";

/**
 * Main Application Controller
 */
class App {
	constructor() {
		this.ui = new UI();
		this.benchmark = new Benchmark(this.ui);
		this.currentImages = {};
		this.settings = new SettingsManager(this);
		// Exposing benchmark globally for UI access
		window.benchmarkInstance = this.benchmark;

		this.init();
	}

	init() {
		console.log("WebAssembly vs JavaScript Benchmark initialized");
		console.log("Configuration:", CONFIG);
		this.setupEventListeners();
	}

	/**
	 * Setup all event listeners: currently for file uploads, test run buttons, metric tabs
	 */
	setupEventListeners() {
		// Upload button listeners
		document.querySelectorAll(".upload-button").forEach((button) => {
			button.addEventListener("click", (e) => {
				const testType = e.target.dataset.test;
				document.querySelector(`.hidden-file-input[data-test="${testType}"]`).click();
			});
		});

		// File input listeners
		document.querySelectorAll(".hidden-file-input").forEach((input) => {
			input.addEventListener("change", (e) => this.handleFileUpload(e));
		});

		// Run test button listeners
		document.querySelectorAll(".run-test-button").forEach((button) => {
			button.addEventListener("click", (e) => this.handleRunTest(e));
		});

		// Metric tab listeners - like execution time, memory, UI freeze
		document.querySelectorAll(".metric-tab").forEach((tab) => {
			tab.addEventListener("click", (e) => this.handleMetricChange(e));
		});
	}

	/**
	 * Handle file upload and validation, used only in tests
	 */
	async handleFileUpload(event) {
		console.log("File upload event:", event);
		const file = event.target.files[0];
		if (!file) return;

		const testType = event.target.dataset.test;

		// Validate file
		if (!file.type.startsWith("image/")) {
			alert("Please upload a valid image file");
			return;
		}

		// Validate file size (max 50MB) REVIEW:
		const maxSize = 50 * 1024 * 1024; // 50MB
		if (file.size > maxSize) {
			alert("File too large. Please upload an image smaller than 50MB");
			return;
		}

		try {
			const dataUrl = await this.readFileAsDataURL(file);

			// Load image to check dimensions
			const tempImage = await ImageUtils.loadImage(dataUrl);

			// Get max dimension for this test type
			const maxDimension = CONFIG.RUNS[testType.toUpperCase()].MAX_DIMENSION;

			// Check if image exceeds maximum dimensions
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

			// Enable run button
			this.ui.enableRunButton(testType);
		} catch (error) {
			console.error("File upload failed:", error);
			alert("Failed to load file. Please try another image.");
		}
	}

	/**
	 * Generate simple hash from image data
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

	/**
	 * Handle running the selected test, currently for 3 tests - invert, edge detection, color quantization
	 */
	async handleRunTest(event) {
		const testType = event.target.dataset.test;

		// Disable button and show running state
		this.ui.setButtonRunning(testType, true);

		try {
			const imageInfo = this.currentImages[testType];
			const imageData = await ImageUtils.loadImage(imageInfo.data);

			// Attach metadata to imageData for tracking
			imageData.hash = imageInfo.hash;
			imageData.filename = imageInfo.filename;

			const runs = this.getRunCount(imageData, testType);

			// Get color count for K-Means test
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

			// Run both tests
			await this.benchmark.runComparison(testType, imageData, runs, colorCount);

			// Update chart with default metric and reset tabs
			const defaultMetric = testType === "invert" ? "time" : "time";
			this.ui.updateChart(testType, defaultMetric);
			this.ui.setActiveMetricTab(testType, defaultMetric);

			// Verify that results are identical
			const isIdentical = await this.benchmark.verifyResults(testType);
			this.ui.showVerificationBadge(testType, isIdentical);

			if (!isIdentical) {
				console.warn("JS and WASM results differ! This may indicate a bug.");
			}
		} catch (error) {
			console.error("Test failed:", error);
			this.ui.showError(testType, error.message || "Test execution failed");
		} finally {
			// Re-enable button
			this.ui.setButtonRunning(testType, false);
		}
	}

	/**
	 * Handle metric tab change, right now four metrics: execution time, memory usage, UI freeze, processed image size REVIEW: maybe will add image dimensions metric
	 */
	handleMetricChange(event) {
		const tab = event.target;
		const testItem = tab.closest(".test-item");
		const testType = testItem.dataset.test;
		const metric = tab.dataset.metric;

		// Update active tab styling
		testItem.querySelectorAll(".metric-tab").forEach((t) => t.classList.remove("active"));
		tab.classList.add("active");

		// Update chart with new metric
		this.ui.updateChart(testType, metric);
	}

	/**
	 * Determine number of runs based on image size and test type, this is to balance freezing, due to heavier tests needing fewer runs
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

	/**
	 * Read file as Data URL, need that because initially we get File object from input and we want to convert to Data URL for image loading
	 */
	readFileAsDataURL(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target.result);
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsDataURL(file);
		});
	}
}

// Initialize app when DOM is ready
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
