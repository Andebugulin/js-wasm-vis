import { ImageUtils } from "./utils.js";
import { CONFIG, METRIC_DISPLAY } from "./config.js";

export class UI {
	constructor() {
		this.maxHistoryItems = CONFIG.STORAGE.MAX_HISTORY_ITEMS;
	}

	showImagePreview(testType, dataUrl) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const containers = testItem.querySelectorAll(".image-container");

		containers.forEach((container) => {
			container.classList.add("has-image");
			const placeholder = container.querySelector(".image-placeholder");
			const actualImage = container.querySelector(".actual-image");

			placeholder.style.display = "none";
			actualImage.src = dataUrl;
			actualImage.classList.add("visible");

			actualImage.onload = () => {
				const widthLabel = container.querySelector(".dimension-width .dim-value");
				const heightLabel = container.querySelector(".dimension-height .dim-value");
				if (widthLabel && heightLabel) {
					widthLabel.textContent = actualImage.naturalWidth;
					heightLabel.textContent = actualImage.naturalHeight;
				}
			};
		});
		const originalContainer = testItem.querySelector('.image-container[data-side="original"]');
		if (originalContainer) {
			originalContainer.classList.add("has-image");
			const placeholder = originalContainer.querySelector(".image-placeholder");
			const actualImage = originalContainer.querySelector(".actual-image");

			placeholder.style.display = "none";
			actualImage.src = dataUrl;
			actualImage.classList.add("visible");

			actualImage.onload = () => {
				const widthLabel = originalContainer.querySelector(".dimension-width .dim-value");
				const heightLabel = originalContainer.querySelector(".dimension-height .dim-value");
				if (widthLabel && heightLabel) {
					widthLabel.textContent = actualImage.naturalWidth;
					heightLabel.textContent = actualImage.naturalHeight;
				}
			};
		}
	}

	showVideoPreview(testType, file) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const containers = testItem.querySelectorAll(".image-container");

		const video = document.createElement("video");
		video.src = URL.createObjectURL(file);

		video.onloadedmetadata = () => {
			containers.forEach((container) => {
				container.classList.add("has-image");
				container.querySelector(".image-placeholder").style.display = "none";

				const widthLabel = container.querySelector(".dimension-width .dim-value");
				const heightLabel = container.querySelector(".dimension-height .dim-value");
				if (widthLabel && heightLabel) {
					widthLabel.textContent = Math.round(video.videoWidth);
					heightLabel.textContent = Math.round(video.videoHeight);
				}

				const batchPreview = container.querySelector(".batch-preview");
				if (batchPreview) batchPreview.classList.add("active");
			});

			URL.revokeObjectURL(video.src);
		};
	}

	enableRunButton(testType) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const button = testItem.querySelector(".run-test-button");
		button.disabled = false;
	}

	setButtonRunning(testType, isRunning) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const button = testItem.querySelector(".run-test-button");
		button.disabled = isRunning;
		button.textContent = isRunning ? "Running..." : "Run Complete Test";
	}

	showCountdown(testType, side, text) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
		const countdown = container.querySelector(".countdown-overlay");

		countdown.textContent = text;
		countdown.classList.add("active");
		container.classList.add("processing");
	}

	hideCountdown(testType, side) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
		const countdown = container.querySelector(".countdown-overlay");

		countdown.classList.remove("active");
		container.classList.remove("processing");
	}

	displayResult(testType, side, imageData) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
		const actualImage = container.querySelector(".actual-image");

		const dataUrl = ImageUtils.imageDataToDataURL(imageData);
		actualImage.src = dataUrl;
	}

	showSpeedupSummary(testType, winner, speedup) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const summaryContainer = testItem.querySelector(".speedup-summary");

		if (!summaryContainer) return;

		const winnerName = winner === "js" ? "JavaScript" : "WebAssembly";
		const winnerColor = winner === "js" ? "var(--accent-js)" : "var(--accent-wasm)";

		summaryContainer.innerHTML = `
            <div class="summary-card">
                <div class="summary-winner" style="color: ${winnerColor}">
                    ${winnerName} Wins
                </div>
                <div class="summary-speedup">
                    ${speedup.toFixed(2)}× faster
                </div>
            </div>
        `;
		summaryContainer.classList.add("active");
	}

	updateChart(testType, metric = "time") {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const chartContainer = testItem.querySelector(".chart-container");
		const results = this.getTestResults(testType);

		if (!results || results.length === 0) {
			chartContainer.innerHTML = `
                <div class="empty-state">
                    Run tests to see performance comparison
                </div>
            `;
			return;
		}

		const displayResults = results
			.filter((result) => result && result.js && result.wasm)
			.slice(-this.maxHistoryItems);
		if (displayResults.length === 0) {
			chartContainer.innerHTML = `
            <div class="empty-state">
                Run tests to see performance comparison
            </div>
        `;
			return;
		}

		const metricConfig = METRIC_DISPLAY[testType]?.[metric];

		if (!metricConfig) {
			console.error(`Unknown metric: ${metric} for test: ${testType}`);
			return;
		}

		if (metric === "imageSize") {
			this.showImageSizeChart(testType, chartContainer);
			return;
		}
		if (metric === "imageFormat") {
			this.showImageFormatChart(testType, chartContainer);
			return;
		}

		chartContainer.innerHTML = `
        <div class="chart-header">
  		    <div class="chart-title">${metricConfig.label} Comparison</div>
 		    <div class="chart-subtitle">${metricConfig.description} (${metricConfig.unit})</div>
    		<button class="export-stats-btn" data-test="${testType}">Export Stats</button>
    		<button class="clear-stats-btn" data-test="${testType}">︎Clear Stats</button>
		</div>
        <div class="chart-canvas-wrapper">
            ${this.createLineChart(displayResults, metricConfig)}
        </div>
        <div class="chart-legend">
            <div class="legend-item">
                <div class="legend-line js"></div>
                <span>JavaScript</span>
            </div>
            <div class="legend-item">
                <div class="legend-line wasm"></div>
                <span>WebAssembly</span>
            </div>
        </div>
        ${this.createStatisticsPanel(displayResults, metricConfig)}
    `;

		const clearBtn = chartContainer.querySelector(".clear-stats-btn");
		if (clearBtn) {
			clearBtn.addEventListener("click", () => {
				if (confirm("Clear all test results for this test?")) {
					this.clearTestResults(testType);
				}
			});
		}

		const exportBtn = chartContainer.querySelector(".export-stats-btn");
		if (exportBtn) {
			exportBtn.addEventListener("click", () => {
				this.exportStatistics(testType, displayResults);
			});
		}
	}

	exportStatistics(testType, results) {
		if (!results || results.length === 0) return;

		const testNames = {
			invert: "Color Inversion",
			batch: "Edge Detection",
			blur: "K-Means Quantization",
		};

		const headers = [
			"Run",
			"JS Execution Time (ms)",
			"WASM Execution Time (ms)",
			"JS Cold Start Overhead (ms)",
			"WASM Cold Start Overhead (ms)",
		];
		if (testType === "invert") {
			headers.push("JS Pixel Rate (Mpx/s)", "WASM Pixel Rate (Mpx/s)");
		}
		headers.push("JS Consistency (CV %)", "WASM Consistency (CV %)", "Speedup");

		const rows = results.map((result, i) => {
			const jsColdStart = result.js.firstRun
				? (result.js.firstRun.executionTime - result.js.median.executionTime).toFixed(2)
				: "N/A";
			const wasmColdStart = result.wasm.firstRun
				? (result.wasm.firstRun.executionTime - result.wasm.median.executionTime).toFixed(2)
				: "N/A";

			const jsCV = ((result.js.stdDev / result.js.mean.executionTime) * 100).toFixed(2);
			const wasmCV = ((result.wasm.stdDev / result.wasm.mean.executionTime) * 100).toFixed(2);

			const speedup = (result.js.median.executionTime / result.wasm.median.executionTime).toFixed(
				2
			);

			const row = [
				i + 1,
				result.js.median.executionTime.toFixed(2),
				result.wasm.median.executionTime.toFixed(2),
				jsColdStart,
				wasmColdStart,
			];

			if (testType === "invert") {
				row.push(
					result.js.median.throughput ? result.js.median.throughput.toFixed(2) : "N/A",
					result.wasm.median.throughput ? result.wasm.median.throughput.toFixed(2) : "N/A"
				);
			}

			row.push(jsCV, wasmCV, speedup);

			return row.join(",");
		});

		const csv = [headers.join(","), ...rows].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${testType}_results.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	exportImageSizeData(testType, sizeData) {
		if (!sizeData || sizeData.length === 0) return;

		const testNames = {
			invert: "Color Inversion",
			batch: "Edge Detection",
			blur: "K-Means Quantization",
		};

		const sorted = [...sizeData].sort((a, b) => a.megapixels - b.megapixels);

		const headers = [
			"Megapixels",
			"JS Time (ms)",
			"WASM Time (ms)",
			"Speedup",
			"Winner",
			"Timestamp",
		];

		const rows = sorted.map((point) => {
			const winner = point.speedup > 1 ? "WASM" : "JS";
			const date = new Date(point.timestamp).toLocaleString();

			return [
				point.megapixels.toFixed(2),
				point.jsTime.toFixed(2),
				point.wasmTime.toFixed(2),
				Math.abs(point.speedup).toFixed(2),
				winner,
				date,
			].join(",");
		});

		const csv = [headers.join(","), ...rows].join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${testType}_image_size_impact.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	setActiveMetricTab(testType, metric) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		testItem.querySelectorAll(".metric-tab").forEach((tab) => {
			if (tab.dataset.metric === metric) {
				tab.classList.add("active");
			} else {
				tab.classList.remove("active");
			}
		});
	}

	showImageSizeChart(testType, chartContainer) {
		const benchmark = window.benchmarkInstance;
		if (!benchmark || !benchmark.imageSizePerformance) {
			chartContainer.innerHTML = '<div class="empty-state">No image size data available</div>';
			return;
		}

		const sizeData = benchmark.imageSizePerformance[testType] || [];

		if (sizeData.length === 0) {
			chartContainer.innerHTML = `
            <div class="empty-state">
                <p>Run tests with different image sizes to see how WASM advantage scales</p>
                <p style="margin-top: 1rem; font-size: 0.85rem; opacity: 0.7;">
                    Try images ranging from 0.5 MP to 50+ MP
                </p>
            </div>
        `;
			return;
		}

		const sorted = [...sizeData].sort((a, b) => a.megapixels - b.megapixels);

		const width = 900;
		const height = 400;
		const marginLeft = 100;
		const marginRight = 80;
		const marginTop = 40;
		const marginBottom = 60;
		const chartWidth = width - marginLeft - marginRight;
		const chartHeight = height - marginTop - marginBottom;

		const maxMP = Math.max(...sorted.map((d) => d.megapixels));
		const minMP = Math.min(...sorted.map((d) => d.megapixels));
		const allSpeedups = sorted.map((d) => d.speedup);
		const maxSpeedup = Math.max(...allSpeedups, 1.5);
		const minSpeedup = Math.min(...allSpeedups, 0.5);

		const scaleX = (mp) => marginLeft + ((mp - minMP) / (maxMP - minMP || 1)) * chartWidth;
		const scaleY = (speedup) =>
			marginTop + chartHeight - ((speedup - minSpeedup) / (maxSpeedup - minSpeedup)) * chartHeight;

		const yTicks = [];
		const numTicks = 7;
		for (let i = 0; i <= numTicks; i++) {
			const value = minSpeedup + ((maxSpeedup - minSpeedup) * i) / numTicks;
			yTicks.push({ value, y: scaleY(value), isParity: Math.abs(value - 1.0) < 0.05 });
		}

		const xTicks = [];
		const numXTicks = 5;
		for (let i = 0; i <= numXTicks; i++) {
			const value = minMP + ((maxMP - minMP) * i) / numXTicks;
			xTicks.push({ value, x: scaleX(value) });
		}

		const parityY = scaleY(1.0);

		chartContainer.innerHTML = `
        <div class="chart-header">
    		<div class="chart-title">WebAssembly Performance Scaling by Image Size</div>
   		    <div class="chart-subtitle">How WASM advantage changes with image dimensions (${
						sizeData.length
					} data points)</div>
    		<button class="export-stats-btn" data-test="${testType}" data-export-type="imageSize">Export stats</button>
    		<button class="clear-stats-btn" data-test="${testType}" data-clear-type="imageSize">Clear Size Data</button>
		</div>
        <div class="chart-canvas-wrapper">
            <svg class="line-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Grid lines -->
                <g class="grid">
                    ${yTicks
											.map(
												(tick) => `
                        <line x1="${marginLeft}" y1="${tick.y}" 
                            x2="${width - marginRight}" y2="${tick.y}" 
                            stroke="${
															tick.isParity ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)"
														}" 
                            stroke-width="${tick.isParity ? "2" : "1"}"
                            stroke-dasharray="${tick.isParity ? "5,5" : "2,4"}"/>
                    `
											)
											.join("")}
                </g>
                
                <!-- Parity line label -->
                <text x="${width - marginRight + 10}" y="${parityY + 5}" 
                    fill="rgba(255,255,255,0.5)" font-size="11" font-family="Courier New">
                    Equal
                </text>
                
                <!-- Axes -->
                <line x1="${marginLeft}" y1="${marginTop}" 
                    x2="${marginLeft}" y2="${height - marginBottom}" 
                    stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                <line x1="${marginLeft}" y1="${height - marginBottom}" 
                    x2="${width - marginRight}" y2="${height - marginBottom}" 
                    stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                
                <!-- Y-axis labels -->
                <g class="y-labels">
                    ${yTicks
											.map(
												(tick) => `
                        <text x="${marginLeft - 10}" y="${tick.y + 5}" 
                            text-anchor="end" 
                            fill="${
															tick.isParity ? "var(--text-highlight)" : "var(--text-secondary)"
														}" 
                            font-size="12" 
                            font-family="Courier New"
                            font-weight="${tick.isParity ? "600" : "400"}">
                            ${tick.value.toFixed(2)}x
                        </text>
                    `
											)
											.join("")}
                </g>
                
                <!-- X-axis labels -->
                <g class="x-labels">
                    ${xTicks
											.map(
												(tick) => `
                        <text x="${tick.x}" y="${height - marginBottom + 25}" 
                            text-anchor="middle" fill="var(--text-secondary)" 
                            font-size="11" font-family="Courier New">
                            ${tick.value.toFixed(1)} MP
                        </text>
                    `
											)
											.join("")}
                </g>
                
                <!-- Data points -->
                ${sorted
									.map((point, i) => {
										const cx = scaleX(point.megapixels);
										const cy = scaleY(point.speedup);
										const color = point.speedup > 1 ? "var(--accent-wasm)" : "var(--accent-js)";
										const winner = point.speedup > 1 ? "WASM" : "JS";

										return `
                        <g class="data-point" data-index="${i}">
                            <circle cx="${cx}" cy="${cy}" r="6" 
                                fill="${color}" 
                                stroke="var(--bg-dark)" 
                                stroke-width="2"
                                opacity="0.8"/>
                            <circle cx="${cx}" cy="${cy}" r="10" 
                                fill="transparent" 
                                class="hover-circle"/>
                            
                            <!-- Tooltip (hidden by default) -->
                            <g class="data-point-labels" style="opacity: 0; pointer-events: none;">
                                <rect x="${cx - 60}" y="${cy}" 
                                    width="140" height="60" 
                                    rx="4" 
                                    fill="var(--bg-dark)" 
                                    stroke="${color}" 
                                    stroke-width="1.5" 
                                    opacity="0.95"/>
                                <text x="${cx - 54}" y="${cy + 15}" 
                                    fill="${color}" 
                                    font-size="11" 
                                    font-family="Courier New" 
                                    font-weight="600">
                                    ${point.megapixels.toFixed(2)} MP
                                </text>
                                <text x="${cx - 54}" y="${cy + 30}" 
                                    fill="var(--text-primary)" 
                                    font-size="10" 
                                    font-family="Courier New">
                                    ${winner} faster: ${Math.abs(point.speedup).toFixed(2)}x
                                </text>
                                <text x="${cx - 54}" y="${cy + 45}" 
                                    fill="var(--text-secondary)" 
                                    font-size="9" 
                                    font-family="Courier New">
                                    JS: ${point.jsTime.toFixed(1)}ms
                                </text>
                                <text x="${cx - 54}" y="${cy + 58}" 
                                    fill="var(--text-secondary)" 
                                    font-size="9" 
                                    font-family="Courier New">
                                    WASM: ${point.wasmTime.toFixed(1)}ms
                                </text>
                            </g>
                        </g>
                    `;
									})
									.join("")}
                
                <!-- Axis labels -->
                <text x="${width / 2}" y="${height - 10}" 
                    text-anchor="middle" 
                    fill="var(--text-highlight)" 
                    font-size="13" 
                    font-family="Courier New" 
                    letter-spacing="1">
                    Image Size (Megapixels)
                </text>
                <text x="25" y="${height / 2}" 
                    text-anchor="middle" 
                    transform="rotate(-90 25 ${height / 2})" 
                    fill="var(--text-highlight)" 
                    font-size="13" 
                    font-family="Courier New" 
                    letter-spacing="1">
                    WASM Speedup Factor
                </text>
            </svg>
        </div>
        
        <div class="chart-legend">
            <div class="legend-item">
                <div class="legend-line wasm"></div>
                <span>WASM Faster (> 1.0x)</span>
            </div>
            <div class="legend-item">
                <div class="legend-line js"></div>
                <span>JS Faster (< 1.0x)</span>
            </div>
        </div>
        
        ${this.createImageSizeInsights(sorted, testType)}
    `;

		chartContainer.querySelectorAll(".data-point").forEach((point) => {
			point.addEventListener("mouseenter", () => {
				const labels = point.querySelector(".data-point-labels");
				if (labels) labels.style.opacity = "1";
			});
			point.addEventListener("mouseleave", () => {
				const labels = point.querySelector(".data-point-labels");
				if (labels) labels.style.opacity = "0";
			});
		});

		const clearBtn = chartContainer.querySelector(".clear-stats-btn");
		if (clearBtn) {
			clearBtn.addEventListener("click", () => {
				if (confirm("Clear all image size performance data?")) {
					benchmark.imageSizePerformance[testType] = [];
					benchmark.saveImageSizeData();
					this.updateChart(testType, "imageSize");
				}
			});
		}

		const exportBtn = chartContainer.querySelector(
			'.export-stats-btn[data-export-type="imageSize"]'
		);
		if (exportBtn) {
			exportBtn.addEventListener("click", () => {
				this.exportImageSizeData(testType, sizeData);
			});
		}
	}

	createImageSizeInsights(sortedData, testType) {
		if (sortedData.length < 3) {
			return `
            <div class="metric-explanation">
                <div class="explanation-header">Understanding Image Size Impact</div>
                <div class="explanation-content">
                    <p><strong>Run tests with various image sizes to see trends</strong></p>
                    <p><em>Tip:</em> Test with small (< 1 MP), medium (1-5 MP), and large (> 10 MP) images</p>
                </div>
            </div>
        `;
		}

		const wasmFasterPoints = sortedData.filter((d) => d.speedup > 1);
		const jsFasterPoints = sortedData.filter((d) => d.speedup < 1);

		let insight = "";
		if (wasmFasterPoints.length > jsFasterPoints.length) {
			const avgWasmAdvantage =
				wasmFasterPoints.reduce((sum, d) => sum + d.speedup, 0) / wasmFasterPoints.length;
			const bestPoint = wasmFasterPoints.reduce((best, d) => (d.speedup > best.speedup ? d : best));

			insight = `
            <p><strong>WebAssembly shows advantage in ${wasmFasterPoints.length} of ${
				sortedData.length
			} test sizes</strong></p>
            <p>Average speedup: <span style="color: var(--accent-wasm)">${avgWasmAdvantage.toFixed(
							2
						)}x faster</span></p>
            <p>Best performance: <span style="color: var(--accent-wasm)">${bestPoint.speedup.toFixed(
							2
						)}x faster</span> at ${bestPoint.megapixels.toFixed(1)} MP</p>
            <p><em>Recommendation:</em> Use WASM for images larger than ${Math.min(
							...wasmFasterPoints.map((d) => d.megapixels)
						).toFixed(1)} MP for best results</p>
        `;
		} else if (jsFasterPoints.length > 0) {
			insight = `
            <p><strong>JavaScript competitive in ${jsFasterPoints.length} of ${sortedData.length} test sizes</strong></p>
            <p><em>Note:</em> For this operation, WASM overhead may outweigh benefits at smaller image sizes</p>
        `;
		}

		return `
        <div class="metric-explanation">
            <div class="explanation-header">📊 Image Size Analysis</div>
            <div class="explanation-content">
                ${insight}
            </div>
        </div>
    `;
	}

	/**
	 * Extract data points from all results for line chart
	 */
	extractDataPoints(results, metricConfig) {
		const jsPoints = [];
		const wasmPoints = [];

		results.forEach((result, index) => {
			let jsValue, wasmValue;

			try {
				if (metricConfig.useCoefficient) {
					jsValue = (result.js.stdDev / result.js.mean.executionTime) * 100;
					wasmValue = (result.wasm.stdDev / result.wasm.mean.executionTime) * 100;
				} else if (metricConfig.compareWithMedian && metricConfig.useFirstRun) {
					const jsFirstRun = result.js.firstRun?.executionTime || 0;
					const jsMedian = result.js.median.executionTime;
					jsValue = jsFirstRun - jsMedian;

					const wasmFirstRun = result.wasm.firstRun?.executionTime || 0;
					const wasmMedian = result.wasm.median.executionTime;
					wasmValue = wasmFirstRun - wasmMedian;
				} else if (metricConfig.useFirstRun) {
					jsValue = result.js.firstRun ? metricConfig.accessor(result.js.firstRun) : null;
					wasmValue = result.wasm.firstRun ? metricConfig.accessor(result.wasm.firstRun) : null;
				} else if (metricConfig.useMean) {
					jsValue = metricConfig.accessor(result.js.mean);
					wasmValue = metricConfig.accessor(result.wasm.mean);
				} else {
					jsValue = metricConfig.accessor(result.js.median);
					wasmValue = metricConfig.accessor(result.wasm.median);
				}

				jsPoints.push({ x: index + 1, y: jsValue });
				wasmPoints.push({ x: index + 1, y: wasmValue });
			} catch (error) {
				console.error("Data extraction error:", error);
				jsPoints.push({ x: index + 1, y: null });
				wasmPoints.push({ x: index + 1, y: null });
			}
		});

		return { jsPoints, wasmPoints };
	}

	createLineChart(results, metricConfig) {
		const { jsPoints, wasmPoints } = this.extractDataPoints(results, metricConfig);

		const validJsPoints = jsPoints.filter((p) => p.y !== null && p.y !== undefined);
		const validWasmPoints = wasmPoints.filter((p) => p.y !== null && p.y !== undefined);

		if (validJsPoints.length === 0 && validWasmPoints.length === 0) {
			return '<div class="empty-state">No valid data points</div>';
		}

		const allValues = [...validJsPoints, ...validWasmPoints].map((p) => p.y);
		const dataMin = Math.min(...allValues);
		const dataMax = Math.max(...allValues);

		let yMin, yMax;
		if (metricConfig.compareWithMedian && metricConfig.useFirstRun) {
			yMin = Math.min(0, dataMin - Math.abs(dataMax - dataMin) * 0.1);
			yMax = dataMax + Math.abs(dataMax - dataMin) * 0.1;
		} else {
			yMin = 0;
			yMax = dataMax + dataMax * 0.1;
		}

		const yRange = yMax - yMin;

		const width = 900;
		const height = 350;
		const marginLeft = 110;
		const marginRight = 80;
		const marginTop = 30;
		const marginBottom = 50;
		const chartWidth = width - marginLeft - marginRight;
		const chartHeight = height - marginTop - marginBottom;

		const scaleX = (runNumber) => {
			if (results.length === 1) {
				return marginLeft + chartWidth / 2;
			}
			return marginLeft + ((runNumber - 1) / (results.length - 1)) * chartWidth;
		};
		const scaleY = (value) => marginTop + chartHeight - ((value - yMin) / yRange) * chartHeight;

		const createPath = (points) => {
			if (points.length === 0) return "";
			return points.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");
		};

		const jsPath = createPath(validJsPoints);
		const wasmPath = createPath(validWasmPoints);

		const yTicks = [];
		const numTicks = 5;

		const isColdStart = metricConfig.compareWithMedian && metricConfig.useFirstRun;

		const includesZero = yMin <= 0 && yMax >= 0;

		if (includesZero) {
			const zeroY = scaleY(0);
			yTicks.push({ value: 0, y: zeroY, isZero: isColdStart });

			const ticksAbove = Math.floor(numTicks / 2);
			for (let i = 1; i <= ticksAbove; i++) {
				const value = (yMax * i) / ticksAbove;
				yTicks.push({ value, y: scaleY(value), isZero: false });
			}

			const ticksBelow = Math.floor(numTicks / 2);
			for (let i = 1; i <= ticksBelow; i++) {
				const value = (yMin * i) / ticksBelow;
				yTicks.push({ value, y: scaleY(value), isZero: false });
			}

			yTicks.sort((a, b) => b.y - a.y);
		} else {
			for (let i = 0; i <= numTicks - 1; i++) {
				const value = yMin + (yRange * i) / (numTicks - 1);
				yTicks.push({ value, y: scaleY(value), isZero: false });
			}
		}

		const xTicks = results.map((_, i) => ({
			label: `Run ${i + 1}`,
			x: scaleX(i + 1),
		}));

		return `
            <svg class="line-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <!-- Grid lines -->
                <g class="grid">
                    ${yTicks
											.map(
												(tick) => `
                        <line x1="${marginLeft}" y1="${tick.y}" 
                            x2="${width - marginRight}" y2="${tick.y}" 
                            stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
                    `
											)
											.join("")}
                </g>
                
                <!-- Y-axis -->
                <line x1="${marginLeft}" y1="${marginTop}" 
                    x2="${marginLeft}" y2="${height - marginBottom}" 
                    stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                
                <!-- X-axis -->
                <line x1="${marginLeft}" y1="${height - marginBottom}" 
                    x2="${width - marginRight}" y2="${height - marginBottom}" 
                    stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                
                <!-- Y-axis labels -->
                <g class="y-labels">
                    ${yTicks
											.map(
												(tick) => `
                        <text x="${marginLeft - 10}" y="${tick.y + 5}" 
                            text-anchor="end" 
                            fill="${
															tick.isZero ? "var(--text-highlight)" : "var(--text-secondary)"
														}" 
                            font-size="12" 
                            font-family="Courier New"
                            font-weight="${tick.isZero ? "600" : "400"}">
                            ${tick.value.toFixed(metricConfig.decimals)}
                        </text>
                    `
											)
											.join("")}
                </g>
                
                <!-- X-axis labels -->
                <g class="x-labels">
                    ${xTicks
											.map(
												(tick) => `
                        <text x="${tick.x}" y="${height - marginBottom + 25}" 
                            text-anchor="middle" fill="var(--text-secondary)" 
                            font-size="11" font-family="Courier New">
                            ${tick.label}
                        </text>
                    `
											)
											.join("")}
                </g>
                
                <!-- Lines -->
                ${
									jsPath
										? `
                    <path d="${jsPath}" 
                        fill="none" 
                        stroke="var(--accent-js)" 
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        z-index="9"/>
                `
										: ""
								}
                
                ${
									wasmPath
										? `
                    <path d="${wasmPath}" 
                        fill="none" 
                        stroke="var(--accent-wasm)" 
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        z-index="9"/>
                `
										: ""
								}
                
                <!-- Data points grouped by run -->
                ${validJsPoints
									.map((jsPoint, index) => {
										const wasmPoint = validWasmPoints[index];
										if (!wasmPoint) return "";

										const jsTextValue = jsPoint.y.toFixed(metricConfig.decimals);
										const jsBoxWidth = Math.max(30, jsTextValue.length * 7 + 8);

										const wasmTextValue = wasmPoint.y.toFixed(metricConfig.decimals);
										const wasmBoxWidth = Math.max(30, wasmTextValue.length * 7 + 8);

										return `
                        <g class="run-group" data-run="${index + 1}">
                            <!-- JS Circle -->
                            <circle cx="${scaleX(jsPoint.x)}" cy="${scaleY(jsPoint.y)}"
                                r="5" fill="var(--accent-js)" stroke="var(--bg-dark)" stroke-width="2"/>
                            <circle cx="${scaleX(jsPoint.x)}" cy="${scaleY(jsPoint.y)}"
                                r="7" fill="transparent" class="hover-circle"/>
                            
                            <!-- WASM Circle -->
                            <circle cx="${scaleX(wasmPoint.x)}" cy="${scaleY(wasmPoint.y)}"
                                r="5" fill="var(--accent-wasm)" stroke="var(--bg-dark)" stroke-width="2"/>
                            <circle cx="${scaleX(wasmPoint.x)}" cy="${scaleY(wasmPoint.y)}"
                                r="7" fill="transparent" class="hover-circle"/>
                            
                            <!-- Labels (hidden by default, shown on hover) -->
                            <g class="data-point-labels">
                                <!-- JS Label -->
                                <rect x="${scaleX(jsPoint.x) - jsBoxWidth - 10}" y="${
											scaleY(jsPoint.y) - 10
										}"
                                    width="${jsBoxWidth}" height="18"
                                    rx="3"
                                    fill="var(--bg-dark)"
                                    stroke="var(--accent-js)"
                                    stroke-width="1"
                                    opacity="0.95"/>
                                <text x="${scaleX(jsPoint.x) - 15}" y="${scaleY(jsPoint.y) + 2}"
                                    text-anchor="end"
                                    fill="var(--accent-js)"
                                    font-size="11"
                                    font-family="Courier New"
                                    font-weight="600">
                                    ${jsTextValue}
                                </text>
                                
                                <!-- WASM Label -->
                                <rect x="${scaleX(wasmPoint.x) + 10}" y="${
											scaleY(wasmPoint.y) - 10
										}"
                                    width="${wasmBoxWidth}" height="18"
                                    rx="3"
                                    fill="var(--bg-dark)"
                                    stroke="var(--accent-wasm)"
                                    stroke-width="1"
                                    opacity="0.95"/>
                                <text x="${scaleX(wasmPoint.x) + 14}" y="${scaleY(wasmPoint.y) + 2}"
                                    text-anchor="start"
                                    fill="var(--accent-wasm)"
                                    font-size="11"
                                    font-family="Courier New"
                                    font-weight="600">
                                    ${wasmTextValue}
                                </text>
                            </g>
                        </g>
                    `;
									})
									.join("")}
                
                <!-- Y-axis label -->
                <text x="20" y="${height / 2}" 
                    text-anchor="middle" 
                    transform="rotate(-90 20 ${height / 2})"
                    fill="var(--text-highlight)" 
                    font-size="13" 
                    font-family="Courier New"
                    letter-spacing="1">
                    ${metricConfig.label} (${metricConfig.unit})
                </text>
            </svg>
        `;
	}

	/**
	 * Clear all test results
	 */
	clearTestResults(testType) {
		sessionStorage.removeItem(`${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`);

		if (window.benchmarkInstance && window.benchmarkInstance.testResults) {
			window.benchmarkInstance.testResults[testType] = [];
		}

		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const chartContainer = testItem.querySelector(".chart-container");

		chartContainer.innerHTML = `
            <div class="empty-state">
                Run tests to see performance comparison
            </div>
        `;

		const summaryContainer = testItem.querySelector(".speedup-summary");
		if (summaryContainer) {
			summaryContainer.classList.remove("active");
		}

		const badge = testItem.querySelector(".verification-badge");
		if (badge) {
			badge.classList.remove("active", "verified", "error");
		}
	}

	createChartGroup(result, runNumber, metricConfig) {
		console.log("createChartGroup called:", {
			runNumber,
			metric: metricConfig.label,
			jsStats: result.js,
			wasmStats: result.wasm,
		});

		let jsValue, wasmValue;

		try {
			if (metricConfig.useMean) {
				jsValue = metricConfig.accessor(result.js.mean);
				wasmValue = metricConfig.accessor(result.wasm.mean);
			} else if (metricConfig.useFirstRun) {
				jsValue = result.js.firstRun ? metricConfig.accessor(result.js.firstRun) : null;
				wasmValue = result.wasm.firstRun ? metricConfig.accessor(result.wasm.firstRun) : null;
			} else {
				jsValue = metricConfig.accessor(result.js.median);
				wasmValue = metricConfig.accessor(result.wasm.median);
			}
		} catch (error) {
			console.error("Accessor error:", error, metricConfig);
			jsValue = null;
			wasmValue = null;
		}

		console.log("Chart values:", { jsValue, wasmValue, metric: metricConfig.label });

		if (metricConfig.useCoefficient) {
			const jsCV = (result.js.stdDev / result.js.mean.executionTime) * 100;
			const wasmCV = (result.wasm.stdDev / result.wasm.mean.executionTime) * 100;

			const maxValue = Math.max(jsCV, wasmCV);
			const jsHeight = (jsCV / maxValue) * 100;
			const wasmHeight = (wasmCV / maxValue) * 100;

			return `
                <div class="chart-group">
                    <div class="chart-bars">
                        <div class="chart-bar" style="height: ${jsHeight}%">
                            <div class="bar-value">${jsCV.toFixed(metricConfig.decimals)}</div>
                        </div>
                        <div class="chart-bar wasm-bar" style="height: ${wasmHeight}%">
                            <div class="bar-value">${wasmCV.toFixed(metricConfig.decimals)}</div>
                        </div>
                    </div>
                    <div class="chart-label">Run ${runNumber}</div>
                </div>
            `;
		}

		if (metricConfig.compareWithMedian && metricConfig.useFirstRun) {
			const jsFirstRun = result.js.firstRun?.executionTime || 0;
			const jsMedian = result.js.median.executionTime;
			const jsOverhead = Math.max(0, jsFirstRun - jsMedian);

			const wasmFirstRun = result.wasm.firstRun?.executionTime || 0;
			const wasmMedian = result.wasm.median.executionTime;
			const wasmOverhead = Math.max(0, wasmFirstRun - wasmMedian);

			const maxValue = Math.max(jsOverhead, wasmOverhead);
			const jsHeight = maxValue > 0 ? (jsOverhead / maxValue) * 100 : 0;
			const wasmHeight = maxValue > 0 ? (wasmOverhead / maxValue) * 100 : 0;

			return `
                <div class="chart-group">
                    <div class="chart-bars">
                        <div class="chart-bar" style="height: ${jsHeight}%">
                            <div class="bar-value">${jsOverhead.toFixed(
															metricConfig.decimals
														)}</div>
                        </div>
                        <div class="chart-bar wasm-bar" style="height: ${wasmHeight}%">
                            <div class="bar-value">${wasmOverhead.toFixed(
															metricConfig.decimals
														)}</div>
                        </div>
                    </div>
                    <div class="chart-label">Run ${runNumber}</div>
                </div>
            `;
		}

		if (
			jsValue === null ||
			jsValue === undefined ||
			wasmValue === null ||
			wasmValue === undefined
		) {
			return `
                <div class="chart-group">
                    <div class="chart-bars">
                        <div class="chart-bar unavailable">
                            <div class="bar-value">N/A</div>
                        </div>
                        <div class="chart-bar wasm-bar unavailable">
                            <div class="bar-value">N/A</div>
                        </div>
                    </div>
                    <div class="chart-label">Run ${runNumber}</div>
                </div>
            `;
		}

		const maxValue = Math.max(Math.abs(jsValue), Math.abs(wasmValue));
		const jsHeight = maxValue > 0 ? (Math.abs(jsValue) / maxValue) * 100 : 0;
		const wasmHeight = maxValue > 0 ? (Math.abs(wasmValue) / maxValue) * 100 : 0;

		console.log("Bar heights:", { jsHeight, wasmHeight, maxValue });

		return `
            <div class="chart-group">
                <div class="chart-bars">
                    <div class="chart-bar" style="height: ${jsHeight}%">
                        <div class="bar-value">${jsValue.toFixed(metricConfig.decimals)}</div>
                    </div>
                    <div class="chart-bar wasm-bar" style="height: ${wasmHeight}%">
                        <div class="bar-value">${wasmValue.toFixed(metricConfig.decimals)}</div>
                    </div>
                </div>
                <div class="chart-label">Run ${runNumber}</div>
            </div>
        `;
	}

	createStatisticsPanel(results, metricConfig) {
		const lastRun = results[results.length - 1];
		const jsStats = lastRun.js;
		const wasmStats = lastRun.wasm;

		if (metricConfig.useCoefficient) {
			const jsCV = (jsStats.stdDev / jsStats.mean.executionTime) * 100;
			const wasmCV = (wasmStats.stdDev / wasmStats.mean.executionTime) * 100;

			return `
                <div class="statistics-panel">
                    <div class="statistics-grid">
                        <div class="stat-card js-stat">
                            <div class="stat-header">JavaScript</div>
                            <div class="stat-row">
                                <span class="stat-label">CV:</span>
                                <span class="stat-value">${jsCV.toFixed(metricConfig.decimals)} ${
				metricConfig.unit
			}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Std Dev:</span>
                                <span class="stat-value">${jsStats.stdDev.toFixed(2)} ms</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Mean Time:</span>
                                <span class="stat-value">${jsStats.mean.executionTime.toFixed(
																	2
																)} ms</span>
                            </div>
                        </div>
                        <div class="stat-card wasm-stat">
                            <div class="stat-header">WebAssembly</div>
                            <div class="stat-row">
                                <span class="stat-label">CV:</span>
                                <span class="stat-value">${wasmCV.toFixed(metricConfig.decimals)} ${
				metricConfig.unit
			}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Std Dev:</span>
                                <span class="stat-value">${wasmStats.stdDev.toFixed(2)} ms</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Mean Time:</span>
                                <span class="stat-value">${wasmStats.mean.executionTime.toFixed(
																	2
																)} ms</span>
                            </div>
                        </div>
                    </div>
                    <div class="stat-note">Lower CV = more predictable performance</div>
                    ${this.getMetricExplanation(metricConfig)}
                </div>
            `;
		}

		let jsMedian, wasmMedian, jsMean, wasmMean, jsMin, jsMax, wasmMin, wasmMax;

		if (metricConfig.useMean) {
			jsMedian = metricConfig.accessor(jsStats.median);
			wasmMedian = metricConfig.accessor(wasmStats.median);
			jsMean = metricConfig.accessor(jsStats.mean);
			wasmMean = metricConfig.accessor(wasmStats.mean);
			jsMin = metricConfig.accessor(jsStats.min);
			jsMax = metricConfig.accessor(jsStats.max);
			wasmMin = metricConfig.accessor(wasmStats.min);
			wasmMax = metricConfig.accessor(wasmStats.max);
		} else if (metricConfig.useFirstRun) {
			if (!jsStats.firstRun || !wasmStats.firstRun) {
				return `
                    <div class="statistics-panel">
                        <div class="stat-unavailable">
                            ! First run data not available
                        </div>
                    </div>
                `;
			}

			if (metricConfig.compareWithMedian) {
				const jsFirstRun = jsStats.firstRun.executionTime;
				const jsMedianTime = jsStats.median.executionTime;
				const jsOverhead = jsFirstRun - jsMedianTime;
				const jsOverheadPercent = (jsOverhead / jsMedianTime) * 100;

				const wasmFirstRun = wasmStats.firstRun.executionTime;
				const wasmMedianTime = wasmStats.median.executionTime;
				const wasmOverhead = wasmFirstRun - wasmMedianTime;
				const wasmOverheadPercent = (wasmOverhead / wasmMedianTime) * 100;

				return `
                    <div class="statistics-panel">
                        <div class="statistics-grid">
                            <div class="stat-card js-stat">
                                <div class="stat-header">JavaScript</div>
                                <div class="stat-row">
                                    <span class="stat-label">First Run:</span>
                                    <span class="stat-value">${jsFirstRun.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Steady State (Median):</span>
                                    <span class="stat-value">${jsMedianTime.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Overhead:</span>
                                    <span class="stat-value">${jsOverhead.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Overhead %:</span>
                                    <span class="stat-value">${jsOverheadPercent.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div class="stat-card wasm-stat">
                                <div class="stat-header">WebAssembly</div>
                                <div class="stat-row">
                                    <span class="stat-label">First Run:</span>
                                    <span class="stat-value">${wasmFirstRun.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Steady State (Median):</span>
                                    <span class="stat-value">${wasmMedianTime.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Overhead:</span>
                                    <span class="stat-value">${wasmOverhead.toFixed(2)} ms</span>
                                </div>
                                <div class="stat-row">
                                    <span class="stat-label">Overhead %:</span>
                                    <span class="stat-value">${wasmOverheadPercent.toFixed(
																			1
																		)}%</span>
                                </div>
                            </div>
                        </div>
                        <div class="stat-note">
                            Cold start includes JIT compilation (JS) and module instantiation (WASM)
                        </div>
                        ${this.getMetricExplanation(metricConfig)}
                    </div>
                `;
			}

			jsMedian = metricConfig.accessor(jsStats.median);
			wasmMedian = metricConfig.accessor(wasmStats.median);
			jsMean = metricConfig.accessor(jsStats.firstRun);
			wasmMean = metricConfig.accessor(wasmStats.firstRun);
			jsMin = metricConfig.accessor(jsStats.min);
			jsMax = metricConfig.accessor(jsStats.max);
			wasmMin = metricConfig.accessor(wasmStats.min);
			wasmMax = metricConfig.accessor(wasmStats.max);
		} else {
			jsMedian = metricConfig.accessor(jsStats.median);
			wasmMedian = metricConfig.accessor(wasmStats.median);
			jsMean = metricConfig.accessor(jsStats.mean);
			wasmMean = metricConfig.accessor(wasmStats.mean);
			jsMin = metricConfig.accessor(jsStats.min);
			jsMax = metricConfig.accessor(jsStats.max);
			wasmMin = metricConfig.accessor(wasmStats.min);
			wasmMax = metricConfig.accessor(wasmStats.max);
		}

		if (
			jsMedian === null ||
			jsMedian === undefined ||
			wasmMedian === null ||
			wasmMedian === undefined
		) {
			return `
                <div class="statistics-panel">
                    <div class="stat-unavailable">
                        ! This metric is not available
                    </div>
                </div>
            `;
		}

		return `
            <div class="statistics-panel">
                <div class="statistics-grid">
                    <div class="stat-card js-stat">
                        <div class="stat-header">JavaScript</div>
                        <div class="stat-row">
                            <span class="stat-label">Median:</span>
                            <span class="stat-value">${jsMedian.toFixed(metricConfig.decimals)} ${
			metricConfig.unit
		}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">${
															metricConfig.useFirstRun ? "First Run:" : "Mean:"
														}</span>
                            <span class="stat-value">${jsMean.toFixed(metricConfig.decimals)} ${
			metricConfig.unit
		}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Range:</span>
                            <span class="stat-value">${jsMin.toFixed(
															metricConfig.decimals
														)} - ${jsMax.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Std Dev:</span>
                            <span class="stat-value">${jsStats.stdDev.toFixed(
															metricConfig.decimals
														)} ms</span>
                        </div>
                    </div>
                    
                    <div class="stat-card wasm-stat">
                        <div class="stat-header">WebAssembly</div>
                        <div class="stat-row">
                            <span class="stat-label">Median:</span>
                            <span class="stat-value">${wasmMedian.toFixed(metricConfig.decimals)} ${
			metricConfig.unit
		}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">${
															metricConfig.useFirstRun ? "First Run:" : "Mean:"
														}</span>
                            <span class="stat-value">${wasmMean.toFixed(metricConfig.decimals)} ${
			metricConfig.unit
		}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Range:</span>
                            <span class="stat-value">${wasmMin.toFixed(
															metricConfig.decimals
														)} - ${wasmMax.toFixed(metricConfig.decimals)} ${
			metricConfig.unit
		}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Std Dev:</span>
                            <span class="stat-value">${wasmStats.stdDev.toFixed(
															metricConfig.decimals
														)} ms</span>
                        </div>
                    </div>
                </div>
                <div class="stat-note">
                    Statistics based on ${jsStats.count} test runs per implementation
                </div>
                ${this.getMetricExplanation(metricConfig)}
            </div>
        `;
	}

	/**
	 * Get explanation text for each metric
	 */
	getMetricExplanation(metricConfig) {
		const explanations = {
			"Execution Time": {
				meaning: "Total time to process the image. Lower values indicate faster processing.",
				tip: "Variations between runs occur due to browser JIT optimization, garbage collection, or system load.",
			},
			"Cold Start Overhead": {
				meaning: "Extra time needed for the first run compared to steady-state performance.",
				tip: "First run includes JIT compilation (JS) and module instantiation (WASM). Shows real-world startup costs.",
			},
			"Pixel Processing Rate": {
				meaning: "Processing speed in millions of pixels per second. Higher is better.",
				tip: "Normalized by image size for fair comparison across different resolutions.",
			},
			"Performance Consistency": {
				meaning: "Coefficient of variation - measures performance predictability.",
				tip: "Lower percentage = more consistent. High values indicate unstable performance (GC spikes, thermal throttling).",
			},
		};

		const info = explanations[metricConfig.label];
		if (!info) return "";

		return `
            <div class="metric-explanation">
                <div class="explanation-header">Understanding This Metric</div>
                <div class="explanation-content">
                    <p><strong>${info.meaning}</strong></p>
                    <p><em>Note:</em> ${info.tip}</p>
                </div>
            </div>
        `;
	}

	/**
	 * Create unavailable chart group
	 */
	createUnavailableChartGroup(runNumber, message) {
		return `
            <div class="chart-group">
                <div class="chart-bars">
                    <div class="chart-bar unavailable">
                        <div class="bar-value">N/A</div>
                    </div>
                    <div class="chart-bar wasm-bar unavailable">
                        <div class="bar-value">N/A</div>
                    </div>
                </div>
                <div class="chart-label">Run ${runNumber}</div>
            </div>
        `;
	}

	/**
	 * Retrieve stored test results
	 */
	getTestResults(testType) {
		const stored = sessionStorage.getItem(`${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`);
		return stored ? JSON.parse(stored) : [];
	}

	/**
	 * Show verification badge
	 */
	showVerificationBadge(testType, isIdentical) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const badge = testItem.querySelector(".verification-badge");

		if (!badge) return;

		if (isIdentical) {
			badge.classList.add("active", "verified");
			badge.textContent = "Results Verified Identical";
			badge.style.borderColor = "rgba(0, 255, 0, 0.3)";
			badge.style.color = "var(--text-highlight)";
		} else {
			badge.classList.add("active", "error");
			badge.textContent = "Results Differ";
			badge.style.borderColor = "rgba(255, 68, 68, 0.3)";
			badge.style.color = "#ff4444";
		}
	}

	/**
	 * Display error message
	 */
	showError(testType, message) {
		const testItem = document.querySelector(`[data-test="${testType}"]`);
		const chartContainer = testItem.querySelector(".chart-container");

		chartContainer.innerHTML = `
            <div class="empty-state error-state">
                <div style="color: #ff4444; font-weight: bold;">Error</div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem;">${message}</div>
            </div>
        `;
	}
}
