// Configuration constants for the benchmark application
export const CONFIG = {
	// Test execution settings
	RUNS: {
		// Test 1: Color Inversion (lightweight)
		INVERT: {
			MAX_DIMENSION: 10000,
			SMALL_IMAGE_THRESHOLD: 4, // MP
			MEDIUM_IMAGE_THRESHOLD: 25, // MP
			SMALL_IMAGE_RUNS: 30,
			MEDIUM_IMAGE_RUNS: 10,
			LARGE_IMAGE_RUNS: 1,
		},
		// Test 2: Edge Detection (medium computation)
		BATCH: {
			MAX_DIMENSION: 10000,
			SMALL_IMAGE_THRESHOLD: 0.5, // MP
			MEDIUM_IMAGE_THRESHOLD: 2, // MP
			SMALL_IMAGE_RUNS: 20,
			MEDIUM_IMAGE_RUNS: 10,
			LARGE_IMAGE_RUNS: 3,
		},
		// Test 3: K-Means (heavy computation)
		BLUR: {
			MAX_DIMENSION: 10000,
			SMALL_IMAGE_THRESHOLD: 0.3, // MP (e.g., 500x600)
			MEDIUM_IMAGE_THRESHOLD: 1, // MP (e.g., 1000x1000)
			SMALL_IMAGE_RUNS: 20,
			MEDIUM_IMAGE_RUNS: 10,
			LARGE_IMAGE_RUNS: 3,
		},
	},

	// UI timing
	TIMING: {
		DELAY_BETWEEN_RUNS: 50,
		COUNTDOWN_DELAY: 800,
		RESULT_DISPLAY_DELAY: 1000,
		MIN_VISUAL_DELAY: 300,
		MAX_VISUAL_DELAY: 1500,
	},

	// Result storage
	STORAGE: {
		MAX_HISTORY_ITEMS: 10,
		SESSION_KEY_PREFIX: "results_",
	},

	// Verification
	VERIFICATION: {
		PIXEL_DIFF_THRESHOLD: 1,
		FLOATING_POINT_TOLERANCE: 0.004,
	},

	// Performance measurement
	PERFORMANCE: {
		TARGET_FPS: 60,
		FRAME_TIME_MS: 16.67,
		MEMORY_AVAILABLE: typeof performance !== "undefined" && performance.memory !== undefined,
	},

	// K-Means configuration
	KMEANS: {
		DEFAULT_COLORS: 256,
		MIN_COLORS: 2,
		MAX_COLORS: 256,
	},
};

// Metric display configuration - per test type
export const METRIC_DISPLAY = {
	invert: {
		time: {
			label: "Execution Time",
			unit: "ms",
			decimals: 2,
			description: "Total processing time",
			accessor: (metrics) => metrics.executionTime,
		},
		warmup: {
			label: "Cold Start Overhead",
			unit: "ms",
			decimals: 2,
			description: "First run penalty (JIT warmup + WASM instantiation)",
			accessor: (metrics) => metrics.executionTime,
			useFirstRun: true,
			compareWithMedian: true,
		},
		pixelRate: {
			label: "Pixel Processing Rate",
			unit: "Mpx/s",
			decimals: 2,
			description: "Million pixels processed per second",
			accessor: (metrics) => metrics.throughput,
		},
		consistency: {
			label: "Performance Consistency",
			unit: "%",
			decimals: 1,
			description: "Coefficient of variation (lower = more consistent)",
			accessor: (metrics) => metrics.executionTime,
			useCoefficient: true,
		},
	},
	batch: {
		time: {
			label: "Execution Time",
			unit: "ms",
			decimals: 2,
			description: "Total processing time",
			accessor: (metrics) => metrics.executionTime,
		},
		warmup: {
			label: "Cold Start Overhead",
			unit: "ms",
			decimals: 2,
			description: "First run penalty (JIT warmup + WASM instantiation)",
			accessor: (metrics) => metrics.executionTime,
			useFirstRun: true,
			compareWithMedian: true,
		},
		consistency: {
			label: "Performance Consistency",
			unit: "%",
			decimals: 1,
			description: "Coefficient of variation (lower = more consistent)",
			accessor: (metrics) => metrics.executionTime,
			useCoefficient: true,
		},
	},
	blur: {
		time: {
			label: "Execution Time",
			unit: "ms",
			decimals: 2,
			description: "Total processing time",
			accessor: (metrics) => metrics.executionTime,
		},
		warmup: {
			label: "Cold Start Overhead",
			unit: "ms",
			decimals: 2,
			description: "First run penalty (JIT warmup + WASM instantiation)",
			accessor: (metrics) => metrics.executionTime,
			useFirstRun: true,
			compareWithMedian: true,
		},
		consistency: {
			label: "Performance Consistency",
			unit: "%",
			decimals: 1,
			description: "Coefficient of variation (lower = more consistent)",
			accessor: (metrics) => metrics.executionTime,
			useCoefficient: true,
		},
	},
};
