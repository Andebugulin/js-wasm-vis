import { CONFIG, METRIC_DISPLAY } from './config.js';

/**
 * Benchmark coordination with comprehensive performance metrics
 */
export class Benchmark {
    constructor(ui) {
        this.ui = ui;
        this.testResults = {};
        this.wasmModule = null; // Cache WASM module, validated - because browser will cache binary but we need to cache initialized js module
    }

    /**
     * Run complete comparison
     */
    async runComparison(testType, imageData, runs) {
        const jsMetricsArray = [];
        const wasmMetricsArray = [];
        
        // === JavaScript Test ===
        this.ui.showCountdown(testType, 'js', 'preparing...');
        await this.delay(CONFIG.TIMING.COUNTDOWN_DELAY);

        for (let i = 0; i < runs; i++) {
            this.ui.showCountdown(testType, 'js', `${i + 1}/${runs} runs`);
            const imageCopy = new ImageData(
                new Uint8ClampedArray(imageData.data),
                imageData.width,
                imageData.height
            );
            const metrics = await this.measurePerformance(testType, 'js', imageCopy, i === 0); 
            jsMetricsArray.push(metrics);
            
            metrics.processedImageData = null;
            
            await this.delay(CONFIG.TIMING.DELAY_BETWEEN_RUNS);
        }

        // === WebAssembly Test ===
        this.ui.showCountdown(testType, 'wasm', 'preparing...');
        await this.delay(CONFIG.TIMING.COUNTDOWN_DELAY);

        for (let i = 0; i < runs; i++) {
            this.ui.showCountdown(testType, 'wasm', `${i + 1}/${runs} runs`);
            const imageCopy = new ImageData(
                new Uint8ClampedArray(imageData.data),
                imageData.width,
                imageData.height
            );
            const metrics = await this.measurePerformance(testType, 'wasm', imageCopy, i === 0); 
            wasmMetricsArray.push(metrics);
            
            // Immediately clear processed image
            metrics.processedImageData = null;
            
            await this.delay(CONFIG.TIMING.DELAY_BETWEEN_RUNS);
        }
        
        // Calculate statistics
        const jsStats = this.calculateStatistics(jsMetricsArray);
        const wasmStats = this.calculateStatistics(wasmMetricsArray);

        // Regenerate ONLY median results for display (memory efficient)
        console.log('Regenerating median results for display...');
        const jsMedianCopy = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        jsStats.median.processedImageData = await this.executeTest(testType, 'js', jsMedianCopy);

        const wasmMedianCopy = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        wasmStats.median.processedImageData = await this.executeTest(testType, 'wasm', wasmMedianCopy);
        
        // Determine winner based on median execution time
        const jsFaster = jsStats.median.executionTime < wasmStats.median.executionTime;
        const timeDiff = Math.abs(
            jsStats.median.executionTime - wasmStats.median.executionTime
        );
        
        // Calculate speedup factor
        const speedup = jsFaster 
            ? wasmStats.median.executionTime / jsStats.median.executionTime
            : jsStats.median.executionTime / wasmStats.median.executionTime;
        
        // Display results in order with visual delay
        if (jsFaster) {
            await this.displayResultWithDelay(testType, 'js', jsStats.median, 'winner');
            await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
            await this.displayResultWithDelay(testType, 'wasm', wasmStats.median, 'slower');
        } else {
            await this.displayResultWithDelay(testType, 'wasm', wasmStats.median, 'winner');
            await this.delay(Math.min(timeDiff, CONFIG.TIMING.MAX_VISUAL_DELAY));
            await this.displayResultWithDelay(testType, 'js', jsStats.median, 'slower');
        }
        
        // Clean up countdowns
        await this.delay(CONFIG.TIMING.RESULT_DISPLAY_DELAY);
        this.ui.hideCountdown(testType, 'js');
        this.ui.hideCountdown(testType, 'wasm');
        
        // Store results with statistics
        this.storeResults(testType, 'js', jsStats);
        this.storeResults(testType, 'wasm', wasmStats);

        // Force garbage collection hint by clearing intermediate arrays
        jsMetricsArray.length = 0;
        wasmMetricsArray.length = 0;
        
        // Display speedup summary
        this.ui.showSpeedupSummary(testType, jsFaster ? 'js' : 'wasm', speedup);
    }

    /**
     * Display result with status indicator
     */
    async displayResultWithDelay(testType, side, metrics, status) {
        const statusText = status === 'winner' ? 'completed 1' : 'completed 2';
        this.ui.showCountdown(testType, side, statusText);
        this.ui.displayResult(testType, side, metrics.processedImageData);
        await this.delay(CONFIG.TIMING.MIN_VISUAL_DELAY);
    }
    async measurePerformance(testType, processorType, imageData, isFirstRun = false) {
        // Execute the actual test
        const startTime = performance.now();
        const processedImageData = await this.executeTest(testType, processorType, imageData);
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
                megapixels
            }
        };
    }

/**
 * Execute the actual image processing test
 */
async executeTest(testType, processorType, imageData) {
    if (testType === 'invert') {
        if (processorType === 'js') {
            const module = await import('./js-processor.js');
            return module.JSProcessor.invertColors(imageData);
        } else {
            // Load and initialize WASM (cached after first load)
            if (!this.wasmModule) {
                try {
                    this.wasmModule = await import('../wasm/test1/wasm-build-test1/wasm_src_test1.js');
                    await this.wasmModule.default();
                } catch (error) {
                    console.error('WASM initialization failed:', error);
                    throw new Error('WebAssembly module failed to load. Check console for details.');
                }
            }
            
            // Measure data transfer time
            const transferStart = performance.now();
            const result = this.wasmModule.invert_colors(imageData);
            const transferEnd = performance.now();
            
            // Attach transfer time to result
            result._transferTime = transferEnd - transferStart;
            return result;
        }
    }
    
    throw new Error(`Test type "${testType}" not implemented`);
}

  /**
 * Calculate statistics from metrics array
 */
calculateStatistics(metricsArray) {
    if (metricsArray.length === 0) {
        throw new Error('Cannot calculate statistics on empty array');
    }

    // Sort by execution time for median
    const sorted = [...metricsArray].sort((a, b) => 
        a.executionTime - b.executionTime
    );
    
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calculate mean
    const sum = metricsArray.reduce((acc, m) => ({
        executionTime: acc.executionTime + m.executionTime,
        throughput: acc.throughput + m.throughput,
    }), {
        executionTime: 0,
        throughput: 0,
    });
    
    const count = metricsArray.length;
    const mean = {
        executionTime: sum.executionTime / count,
        throughput: sum.throughput / count,
    };
    
    // Calculate standard deviation (must be AFTER mean is calculated)
    const squaredDiffs = metricsArray.reduce((acc, m) => 
        acc + Math.pow(m.executionTime - mean.executionTime, 2), 0
    );
    const stdDev = Math.sqrt(squaredDiffs / count);
    
    // Calculate coefficient of variation (must be AFTER stdDev)
    const coefficientOfVariation = (stdDev / mean.executionTime) * 100;
    
    // Find min and max
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const firstRun = metricsArray.find(m => m.isFirstRun);
    
    return {
        median,
        mean,
        stdDev,
        coefficientOfVariation,
        min,
        max,
        count,
        firstRun,
        allRuns: metricsArray
    };
}
 /**
 * Store results in memory and sessionStorage
 */
storeResults(testType, processorType, statistics) {
    // Initialize storage
    if (!this.testResults[testType]) {
        this.testResults[testType] = [];
    }
    
    let results = this.testResults[testType];
    let currentRun = results[results.length - 1];
    
    // Create new run if needed
    if (!currentRun || (currentRun.js && currentRun.wasm)) {
        currentRun = {};
        results.push(currentRun);
    }
    
    // Store full statistics in memory (includes ImageData)
    currentRun[processorType] = statistics;
    
    // Clear ImageData from all runs except current median
    if (results.length > 1) {
        results.slice(0, -1).forEach(oldRun => {
            if (oldRun.js?.median?.processedImageData) oldRun.js.median.processedImageData = null;
            if (oldRun.wasm?.median?.processedImageData) oldRun.wasm.median.processedImageData = null;
        });
    }
   
    // Store limited data in sessionStorage (no ImageData)
    const stored = sessionStorage.getItem(
        `${CONFIG.STORAGE.SESSION_KEY_PREFIX}${testType}`
    );
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
        firstRun: this.sanitizeMetrics(statistics.firstRun)
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
        return rest;  // Keep everything except processedImageData
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
        if (!lastRun?.js?.median?.processedImageData || 
            !lastRun?.wasm?.median?.processedImageData) {
            return false;
        }
        
        const jsData = lastRun.js.median.processedImageData.data;
        const wasmData = lastRun.wasm.median.processedImageData.data;
        
        if (jsData.length !== wasmData.length) {
            console.error('Result length mismatch');
            return false;
        }
        
        // Compare with threshold
        const threshold = CONFIG.VERIFICATION.PIXEL_DIFF_THRESHOLD;
        for (let i = 0; i < jsData.length; i++) {
            if (Math.abs(jsData[i] - wasmData[i]) > threshold) {
                console.error(
                    `Pixel difference at index ${i}: JS=${jsData[i]}, WASM=${wasmData[i]}`
                );
                return false;
            }
        }
        
        return true;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}