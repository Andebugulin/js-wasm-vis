// Benchmark coordination and timing
export class Benchmark {
    constructor(ui) {
        this.ui = ui;
        this.testResults = {};
        this.wasmModule = null; // Cache WASM module, validated - because browser will cache binary but we need to cache initialized js module
    }

    async runTest(testType, processorType, imageData) {
        console.log(`Running ${testType} test with ${processorType}`);

        // Measure performance
        const metrics = await this.measurePerformance(testType, processorType, imageData);
        
        // Store results
        this.storeResults(testType, processorType, metrics);

        return metrics;
    }

    async measurePerformance(testType, processorType, imageData) {
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const startTime = performance.now();

        // Execute the test (this is what we measure)
        const processedImageData = await this.executeTest(testType, processorType, imageData);

        const endTime = performance.now();
        const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

        return {
            executionTime: endTime - startTime,
            memoryUsage: (endMemory - startMemory) / (1024 * 1024),
            uiFreeze: endTime - startTime,
            processedImageData: processedImageData
        };
    }

    async executeTest(testType, processorType, imageData) {
        // Create a COPY of imageData to avoid mutation, not really sure that it was needed, but it fixed my issue with displaying correct inverted image after wasm processing
        const imageCopy = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        
        if (testType === 'invert') {
            if (processorType === 'js') {
                const module = await import('./js-processor.js');
                return module.JSProcessor.invertColors(imageCopy);
            } else {
                // TODO: Load and cache WASM module (only once) as already mentioned above, I am not sure that it is needed, but just in case
                if (!this.wasmModule) {
                    this.wasmModule = await import('../wasm/test1/wasm-build-test1/wasm_src_test1.js');
                    await this.wasmModule.default(); // Initialize once
                }
                return this.wasmModule.invert_colors(imageCopy);
            }
        }
    }

    storeResults(testType, processorType, metrics) {
        if (!this.testResults[testType]) {
            this.testResults[testType] = [];
        }
        
        let results = this.testResults[testType];
        let currentRun = results[results.length - 1];
        
        if (!currentRun || (currentRun.js && currentRun.wasm)) {
            currentRun = {};
            results.push(currentRun);
        }
        
        // Store metrics in memory (includes ImageData) TODO: later on I will try to figure out what other metrics can be stored and used for comparison
        currentRun[processorType] = {
            executionTime: metrics.executionTime,
            memoryUsage: metrics.memoryUsage,
            uiFreeze: metrics.uiFreeze,
            processedImageData: metrics.processedImageData // Keep in memory
        };
        
        // Store only metrics (NO ImageData) in sessionStorage for persistence across reloads, still limited to closing window, but for this case, it is fine
        const stored = sessionStorage.getItem(`results_${testType}`);
        let storedResults = stored ? JSON.parse(stored) : [];
        let storedRun = storedResults[storedResults.length - 1];
        
        if (!storedRun || (storedRun.js && storedRun.wasm)) {
            storedRun = {};
            storedResults.push(storedRun);
        }
        
        storedRun[processorType] = {
            executionTime: metrics.executionTime,
            memoryUsage: metrics.memoryUsage,
            uiFreeze: metrics.uiFreeze
            // NO processedImageData here
        };
        
        if (storedResults.length > 10) {
            storedResults = storedResults.slice(-10);
        }
        
        if (results.length > 10) {
            results = results.slice(-10);
        }
        
        sessionStorage.setItem(`results_${testType}`, JSON.stringify(storedResults));
    }

    async verifyResults(testType) {
        console.log(`Verifying results for ${testType}`);
        
        // Use in memory results (not sessionStorage)
        const results = this.testResults[testType];
        if (!results || results.length === 0) return false;
        
        const lastRun = results[results.length - 1];
        
        if (!lastRun?.js?.processedImageData || !lastRun?.wasm?.processedImageData) {
            return false;
        }
        
        const jsData = lastRun.js.processedImageData.data;
        const wasmData = lastRun.wasm.processedImageData.data;
        
        if (jsData.length !== wasmData.length) return false;
        
        // Compare pixel data (allow small floating point differences), just to make sure that images were processed identically
        const threshold = 1; // Allow 1-point RGB difference
        for (let i = 0; i < jsData.length; i++) {
            if (Math.abs(jsData[i] - wasmData[i]) > threshold) {
                console.log(`Pixel difference at index ${i}: JS=${jsData[i]}, WASM=${wasmData[i]}`);
                return false;
            }
        }
        
        return true;
    }
}