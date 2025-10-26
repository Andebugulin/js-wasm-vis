import { ImageUtils } from './utils.js';
import { CONFIG, METRIC_DISPLAY } from './config.js';

/**
 * UI updates and visualization
 */
export class UI {
    constructor() {
        this.maxHistoryItems = CONFIG.STORAGE.MAX_HISTORY_ITEMS;
    }

    // === File Preview Display ===
    showImagePreview(testType, dataUrl) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const containers = testItem.querySelectorAll('.image-container');
        
        containers.forEach(container => {
            container.classList.add('has-image');
            const placeholder = container.querySelector('.image-placeholder');
            const actualImage = container.querySelector('.actual-image');
            
            placeholder.style.display = 'none';
            actualImage.src = dataUrl;
            actualImage.classList.add('visible');

            actualImage.onload = () => {
                const widthLabel = container.querySelector('.dimension-width .dim-value');
                const heightLabel = container.querySelector('.dimension-height .dim-value');
                if (widthLabel && heightLabel) {
                    widthLabel.textContent = actualImage.naturalWidth;
                    heightLabel.textContent = actualImage.naturalHeight;
                }
            };

            // Batch preview handling
            if (testType === 'batch') {
                const batchPreview = container.querySelector('.batch-preview');
                if (batchPreview) {
                    batchPreview.classList.add('active');
                    const layers = batchPreview.querySelectorAll('.batch-layer');
                    layers.forEach((layer, i) => {
                        layer.style.backgroundImage = `url(${dataUrl})`;
                        layer.textContent = '';
                        const offset = i * 35;
                        layer.style.transform = `translate(${offset}px, ${offset}px)`;
                        layer.style.zIndex = layers.length - i;
                    });
                }
            }
        });
    }

    showVideoPreview(testType, file) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const containers = testItem.querySelectorAll('.image-container');
        
        // Create temporary video element to get dimensions
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        
        video.onloadedmetadata = () => {
            containers.forEach(container => {
                container.classList.add('has-image');
                container.querySelector('.image-placeholder').style.display = 'none';
                
                const widthLabel = container.querySelector('.dimension-width .dim-value');
                const heightLabel = container.querySelector('.dimension-height .dim-value');
                if (widthLabel && heightLabel) {
                    widthLabel.textContent = Math.round(video.videoWidth);
                    heightLabel.textContent = Math.round(video.videoHeight);
                }
                
                const batchPreview = container.querySelector('.batch-preview');
                if (batchPreview) batchPreview.classList.add('active');
            });
            
            URL.revokeObjectURL(video.src);
        };
    }

    enableRunButton(testType) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const button = testItem.querySelector('.run-test-button');
        button.disabled = false;
    }

    setButtonRunning(testType, isRunning) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const button = testItem.querySelector('.run-test-button');
        button.disabled = isRunning;
        button.textContent = isRunning ? '⏳ Running...' : '▶ Run Complete Test';
    }
    

    // === Countdown Overlay Controls ===
    
    showCountdown(testType, side, text) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
        const countdown = container.querySelector('.countdown-overlay');
        
        countdown.textContent = text;
        countdown.classList.add('active');
        container.classList.add('processing');
    }

    hideCountdown(testType, side) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
        const countdown = container.querySelector('.countdown-overlay');
        
        countdown.classList.remove('active');
        container.classList.remove('processing');
    }

    displayResult(testType, side, imageData) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
        const actualImage = container.querySelector('.actual-image');
        
        const dataUrl = ImageUtils.imageDataToDataURL(imageData);
        actualImage.src = dataUrl;
    }

    // === Performance Visualization ===
    
    /**
     * Display speedup summary card
     */
    showSpeedupSummary(testType, winner, speedup) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const summaryContainer = testItem.querySelector('.speedup-summary');
        
        if (!summaryContainer) return;
        
        const winnerName = winner === 'js' ? 'JavaScript' : 'WebAssembly';
        const winnerColor = winner === 'js' ? 'var(--accent-js)' : 'var(--accent-wasm)';
        
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
        summaryContainer.classList.add('active');
    }

    /**
     * Update chart with selected metric
     */
    updateChart(testType, metric = 'time') {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const chartContainer = testItem.querySelector('.chart-container');
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
            .filter(result => result && result.js && result.wasm)
            .slice(-this.maxHistoryItems);
        // If no complete results, show empty state
        if (displayResults.length === 0) {
        chartContainer.innerHTML = `
            <div class="empty-state">
                Run tests to see performance comparison
            </div>
        `;
        return;
        }

        const metricConfig = METRIC_DISPLAY[metric];
        
        if (!metricConfig) {
            console.error(`Unknown metric: ${metric}`);
            return;
        }


        chartContainer.innerHTML = `
            <div class="chart-header">
                <div class="chart-title">${metricConfig.label} Comparison</div>
                <div class="chart-subtitle">${metricConfig.description} (${metricConfig.unit})</div>
            </div>
            <div class="chart-canvas">
                ${displayResults.map((result, index) => 
                    this.createChartGroup(result, index + 1, metricConfig)
                ).join('')}
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color js"></div>
                    <span>JavaScript</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color wasm"></div>
                    <span>WebAssembly</span>
                </div>
            </div>
            ${this.createStatisticsPanel(displayResults, metricConfig)}
        `;
    }

    /**
     * Set active metric tab
     */
    setActiveMetricTab(testType, metric) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        testItem.querySelectorAll('.metric-tab').forEach(tab => {
            if (tab.dataset.metric === metric) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
/**
 * Create a chart group (pair of bars) for one test run
 */
createChartGroup(result, runNumber, metricConfig) {
    // Debug logging
    console.log('createChartGroup called:', {
        runNumber,
        metric: metricConfig.label,
        jsStats: result.js,
        wasmStats: result.wasm
    });
    
    // Determine which value to show
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
        console.error('Accessor error:', error, metricConfig);
        jsValue = null;
        wasmValue = null;
    }

    console.log('Chart values:', { jsValue, wasmValue, metric: metricConfig.label });
    
    // Special handling for coefficient of variation
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

    // Special handling for warmup comparison
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
                        <div class="bar-value">${jsOverhead.toFixed(metricConfig.decimals)}</div>
                    </div>
                    <div class="chart-bar wasm-bar" style="height: ${wasmHeight}%">
                        <div class="bar-value">${wasmOverhead.toFixed(metricConfig.decimals)}</div>
                    </div>
                </div>
                <div class="chart-label">Run ${runNumber}</div>
            </div>
        `;
    }
    
    // Handle null/undefined values for normal metrics
    if (jsValue === null || jsValue === undefined || wasmValue === null || wasmValue === undefined) {
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
    
    // Normal metrics (execution time, pixel rate) - CALCULATE HEIGHTS HERE
    const maxValue = Math.max(Math.abs(jsValue), Math.abs(wasmValue));
    const jsHeight = maxValue > 0 ? (Math.abs(jsValue) / maxValue) * 100 : 0;
    const wasmHeight = maxValue > 0 ? (Math.abs(wasmValue) / maxValue) * 100 : 0;

    console.log('Bar heights:', { jsHeight, wasmHeight, maxValue });
    
    // RETURN STATEMENT FOR NORMAL METRICS
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
/**
 * Create statistics panel showing detailed metrics
 */
createStatisticsPanel(results, metricConfig) {
    // Calculate overall statistics
    const lastRun = results[results.length - 1];
    const jsStats = lastRun.js;
    const wasmStats = lastRun.wasm;

    // Special handling for coefficient of variation
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
                            <span class="stat-value">${jsCV.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Std Dev:</span>
                            <span class="stat-value">${jsStats.stdDev.toFixed(2)} ms</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Mean Time:</span>
                            <span class="stat-value">${jsStats.mean.executionTime.toFixed(2)} ms</span>
                        </div>
                    </div>
                    <div class="stat-card wasm-stat">
                        <div class="stat-header">WebAssembly</div>
                        <div class="stat-row">
                            <span class="stat-label">CV:</span>
                            <span class="stat-value">${wasmCV.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Std Dev:</span>
                            <span class="stat-value">${wasmStats.stdDev.toFixed(2)} ms</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Mean Time:</span>
                            <span class="stat-value">${wasmStats.mean.executionTime.toFixed(2)} ms</span>
                        </div>
                    </div>
                </div>
                <div class="stat-note">Lower CV = more predictable performance</div>
                ${this.getMetricExplanation(metricConfig)}
            </div>
        `;
    }

    // Get values based on metric configuration
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
        
        // For warmup comparison, show the overhead
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
                                <span class="stat-value">${wasmOverheadPercent.toFixed(1)}%</span>
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
    
    // Handle unavailable metrics (null/undefined values)
    if (jsMedian === null || jsMedian === undefined || wasmMedian === null || wasmMedian === undefined) {
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
                        <span class="stat-value">${jsMedian.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">${metricConfig.useFirstRun ? 'First Run:' : 'Mean:'}</span>
                        <span class="stat-value">${jsMean.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">${jsMin.toFixed(metricConfig.decimals)} - ${jsMax.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Std Dev:</span>
                        <span class="stat-value">${jsStats.stdDev.toFixed(metricConfig.decimals)} ms</span>
                    </div>
                </div>
                
                <div class="stat-card wasm-stat">
                    <div class="stat-header">WebAssembly</div>
                    <div class="stat-row">
                        <span class="stat-label">Median:</span>
                        <span class="stat-value">${wasmMedian.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">${metricConfig.useFirstRun ? 'First Run:' : 'Mean:'}</span>
                        <span class="stat-value">${wasmMean.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">${wasmMin.toFixed(metricConfig.decimals)} - ${wasmMax.toFixed(metricConfig.decimals)} ${metricConfig.unit}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Std Dev:</span>
                        <span class="stat-value">${wasmStats.stdDev.toFixed(metricConfig.decimals)} ms</span>
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
    'Execution Time': {
        meaning: 'Total time to process the image. Lower values indicate faster processing.',
        tip: 'Variations between runs occur due to browser JIT optimization, garbage collection, or system load.'
    },
    'Cold Start Overhead': {
        meaning: 'Extra time needed for the first run compared to steady-state performance.',
        tip: 'First run includes JIT compilation (JS) and module instantiation (WASM). Shows real-world startup costs.'
    },
    'Pixel Processing Rate': {
        meaning: 'Processing speed in millions of pixels per second. Higher is better.',
        tip: 'Normalized by image size for fair comparison across different resolutions.'
    },
    'Performance Consistency': {
        meaning: 'Coefficient of variation - measures performance predictability.',
        tip: 'Lower percentage = more consistent. High values indicate unstable performance (GC spikes, thermal throttling).'
    }
};
    
    const info = explanations[metricConfig.label];
    if (!info) return '';
    
    return `
        <div class="metric-explanation">
            <div class="explanation-header">💡 Understanding This Metric</div>
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
        const stored = sessionStorage.getItem(
            `${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`
        );
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Show verification badge
     */
    showVerificationBadge(testType, isIdentical) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const badge = testItem.querySelector('.verification-badge');
        
        if (!badge) return;
        
        if (isIdentical) {
            badge.classList.add('active', 'verified');
            badge.textContent = 'Results Verified Identical';
            badge.style.borderColor = 'rgba(0, 255, 0, 0.3)';
            badge.style.color = 'var(--text-highlight)';
        } else {
            badge.classList.add('active', 'error');
            badge.textContent = 'Results Differ';
            badge.style.borderColor = 'rgba(255, 68, 68, 0.3)';
            badge.style.color = '#ff4444';
        }
    }

    /**
     * Display error message
     */
    showError(testType, message) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const chartContainer = testItem.querySelector('.chart-container');
        
        chartContainer.innerHTML = `
            <div class="empty-state error-state">
                <div style="color: #ff4444; font-weight: bold;">Error</div>
                <div style="margin-top: 0.5rem; font-size: 0.85rem;">${message}</div>
            </div>
        `;
    }
}