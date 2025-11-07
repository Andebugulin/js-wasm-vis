// Configuration constants for the benchmark application
export const CONFIG = {
	// Test execution settings
	RUNS: {
		SMALL_IMAGE_THRESHOLD: 4,
		MEDIUM_IMAGE_THRESHOLD: 25,
		SMALL_IMAGE_RUNS: 30,
		MEDIUM_IMAGE_RUNS: 10,
		LARGE_IMAGE_RUNS: 1,
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

	// Metrics to collect TODO: clear up
	METRICS: {
		EXECUTION_TIME: "executionTime",
		MEMORY_USAGE: "memoryUsage",
		CPU_BLOCKING: "cpuBlocking",
		THROUGHPUT: "throughput",
		DATA_TRANSFER_TIME: "dataTransferTime",
	},
};

// Metric display configuration
export const METRIC_DISPLAY = {
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
};
