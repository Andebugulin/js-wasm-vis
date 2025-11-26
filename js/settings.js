import { CONFIG } from "./config.js";

export class SettingsManager {
	constructor(app) {
		this.app = app;
		this.storageKey = "benchmarkSettings";
		this.currentTest = null;
		this.loadSettings();
		this.initUI();
	}

	loadSettings() {
		const stored = localStorage.getItem(this.storageKey);
		if (stored) {
			try {
				const settings = JSON.parse(stored);
				this.applySettings(settings);
			} catch (e) {
				console.warn("Failed to load settings:", e);
			}
		}
	}

	applySettings(settings) {
		Object.keys(settings).forEach((testType) => {
			const testKey = testType.toUpperCase();
			if (CONFIG.RUNS[testKey] && settings[testType]) {
				CONFIG.RUNS[testKey].MAX_DIMENSION = settings[testType].maxDimension;
				CONFIG.RUNS[testKey].SMALL_IMAGE_THRESHOLD = settings[testType].smallThreshold;
				CONFIG.RUNS[testKey].MEDIUM_IMAGE_THRESHOLD = settings[testType].mediumThreshold;
				CONFIG.RUNS[testKey].SMALL_IMAGE_RUNS = settings[testType].smallRuns;
				CONFIG.RUNS[testKey].MEDIUM_IMAGE_RUNS = settings[testType].mediumRuns;
				CONFIG.RUNS[testKey].LARGE_IMAGE_RUNS = settings[testType].largeRuns;
			}
		});
	}

	openSettings(testType) {
		this.currentTest = testType;
		const overlay = document.getElementById("settingsOverlay");
		overlay.classList.add("active");
		this.populateUI();
	}

	saveSettings() {
		if (!this.currentTest) return;

		const testKey = this.currentTest.toUpperCase();
		const settings = JSON.parse(localStorage.getItem(this.storageKey) || "{}");

		settings[this.currentTest] = {
			maxDimension: parseInt(document.getElementById("setting-max-dimension").value),
			smallThreshold: parseFloat(document.getElementById("setting-small-threshold").value),
			mediumThreshold: parseFloat(document.getElementById("setting-medium-threshold").value),
			smallRuns: parseInt(document.getElementById("setting-small-runs").value),
			mediumRuns: parseInt(document.getElementById("setting-medium-runs").value),
			largeRuns: parseInt(document.getElementById("setting-large-runs").value),
		};

		localStorage.setItem(this.storageKey, JSON.stringify(settings));
		this.applySettings(settings);
		alert("Settings saved successfully!");
	}

	resetSettings() {
		if (confirm("Reset settings for this test to defaults?")) {
			const settings = JSON.parse(localStorage.getItem(this.storageKey) || "{}");
			delete settings[this.currentTest];
			localStorage.setItem(this.storageKey, JSON.stringify(settings));
			location.reload();
		}
	}

	initUI() {
		// Settings trigger buttons in sticky headers
		document.querySelectorAll(".sticky-settings-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const testType = e.target.dataset.test;
				this.openSettings(testType);
			});
		});

		const overlay = document.getElementById("settingsOverlay");
		const closeBtn = document.getElementById("settingsClose");
		const saveBtn = document.getElementById("settingsSave");
		const resetBtn = document.getElementById("settingsReset");

		closeBtn?.addEventListener("click", () => {
			overlay.classList.remove("active");
		});

		overlay?.addEventListener("click", (e) => {
			if (e.target === overlay) overlay.classList.remove("active");
		});

		saveBtn?.addEventListener("click", () => {
			this.saveSettings();
			overlay.classList.remove("active");
		});

		resetBtn?.addEventListener("click", () => this.resetSettings());
	}

	populateUI() {
		if (!this.currentTest) return;

		const testKey = this.currentTest.toUpperCase();
		const config = CONFIG.RUNS[testKey];

		// Update title
		const testNames = {
			invert: "Color Inversion",
			batch: "Edge Detection",
			blur: "K-Means Quantization",
		};
		document.getElementById("settingsTestTitle").textContent = `${
			testNames[this.currentTest]
		} Settings`;

		// Populate fields
		document.getElementById("setting-max-dimension").value = config.MAX_DIMENSION;
		document.getElementById("setting-small-threshold").value = config.SMALL_IMAGE_THRESHOLD;
		document.getElementById("setting-medium-threshold").value = config.MEDIUM_IMAGE_THRESHOLD;
		document.getElementById("setting-small-runs").value = config.SMALL_IMAGE_RUNS;
		document.getElementById("setting-medium-runs").value = config.MEDIUM_IMAGE_RUNS;
		document.getElementById("setting-large-runs").value = config.LARGE_IMAGE_RUNS;

		// Show current image info if available
		this.updateCurrentImageInfo();
	}

	updateCurrentImageInfo() {
		const imageInfo = this.app.currentImages[this.currentTest];
		const infoSection = document.getElementById("currentImageInfo");

		if (!imageInfo) {
			infoSection.style.display = "none";
			return;
		}

		infoSection.style.display = "block";
		const { width, height } = imageInfo.dimensions;
		const megapixels = (width * height) / 1_000_000;

		document.getElementById("currentImageDimensions").textContent = `${width} × ${height}`;
		document.getElementById("currentImageMP").textContent = `${megapixels.toFixed(2)} MP`;

		// Determine category
		const testKey = this.currentTest.toUpperCase();
		const config = CONFIG.RUNS[testKey];
		let category = "Large";
		if (megapixels < config.SMALL_IMAGE_THRESHOLD) category = "Small";
		else if (megapixels < config.MEDIUM_IMAGE_THRESHOLD) category = "Medium";

		document.getElementById("currentImageCategory").textContent = `${category} (${this.getRunCount(
			category
		)} runs)`;
	}

	getRunCount(category) {
		const testKey = this.currentTest.toUpperCase();
		const config = CONFIG.RUNS[testKey];
		if (category === "Small") return config.SMALL_IMAGE_RUNS;
		if (category === "Medium") return config.MEDIUM_IMAGE_RUNS;
		return config.LARGE_IMAGE_RUNS;
	}
}
