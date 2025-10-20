// Main application entry point
import { UI } from './ui.js';
import { Benchmark } from './benchmark.js';
import { ImageUtils } from './utils.js';

class App {
    constructor() {
        this.ui = new UI();
        this.benchmark = new Benchmark(this.ui);
        this.currentImages = {}; 
        this.init();
    }

    init() {
        console.log('WebAssembly vs JavaScript Benchmark initialized');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Upload button listeners - like "Upload Image"
        document.querySelectorAll('.upload-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const testType = e.target.dataset.test;
                const fileInput = document.querySelector(`.hidden-file-input[data-test="${testType}"]`);
                fileInput.click();
            });
        });

        // File input listeners
        document.querySelectorAll('.hidden-file-input').forEach(input => {
            input.addEventListener('change', (e) => this.handleFileUpload(e));
        });

        // Run test button listeners - like "Run Complete Test"
        document.querySelectorAll('.run-test-button').forEach(button => {
            button.addEventListener('click', (e) => this.handleRunTest(e));
        });

        // Metric tab listeners - like execution time, memory, UI freeze
        document.querySelectorAll('.metric-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleMetricChange(e));
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const testType = event.target.dataset.test;
        const testItem = document.querySelector(`[data-test="${testType}"]`);

        // Check file type
        if (testType === 'batch' && file.type.startsWith('video/')) {
            await this.handleVideoUpload(file, testType, testItem);
        } else if (file.type.startsWith('image/')) {
            await this.handleImageUpload(file, testType, testItem);
        } else {
            alert('Please upload a valid image or video file');
            return;
        }

        // Enable run button
        const runButton = testItem.querySelector('.run-test-button');
        runButton.disabled = false;
    }

    async handleImageUpload(file, testType, testItem) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            this.currentImages[testType] = imageUrl;

            // Update both image containers
            const containers = testItem.querySelectorAll('.image-container');
            containers.forEach(container => {
                container.classList.add('has-image');
                const placeholder = container.querySelector('.image-placeholder');
                const actualImage = container.querySelector('.actual-image');
                
                placeholder.style.display = 'none';
                actualImage.src = imageUrl;
                actualImage.classList.add('visible');

                // For batch test, show stack preview
                if (testType === 'batch') {
                    const batchPreview = container.querySelector('.batch-preview');
                    if (batchPreview) {
                        batchPreview.classList.add('active');
                        const layers = batchPreview.querySelectorAll('.batch-layer');
                        layers.forEach((layer, i) => {
                            layer.style.backgroundImage = `url(${imageUrl})`;
                            layer.textContent = '';
                            layer.style.opacity = 5;
                            const offset = i * 35;
                            layer.style.transform = `translate(${offset}px, ${offset}px)`;
                            layer.style.zIndex = layers.length - i;
                        });
                    }
                }
            });
        };

        reader.readAsDataURL(file);
    }

    async handleVideoUpload(file, testType, testItem) {
        const containers = testItem.querySelectorAll('.image-container');
        containers.forEach(container => {
            container.classList.add('has-image');
            const placeholder = container.querySelector('.image-placeholder');
            const batchPreview = container.querySelector('.batch-preview');
            
            placeholder.style.display = 'none';
            if (batchPreview) {
                batchPreview.classList.add('active');
            }
        });

        this.currentImages[testType] = file;
    }

    async handleRunTest(event) {
        const button = event.target;
        const testType = button.dataset.test;
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        
        button.disabled = true;
        button.textContent = '⏳ Running...';
    
        const RUNS = 1; // TODO: Parameter: number of runs per test, NEEDS TO BE CAREFULLY CHOSEN CAN LEAD TO FREEZE AND HIGH MEMORY USAGE, I think 
        // i need to make logic that would check image dimensions, because it highly depends on it, if image is more than 8000 x Y
        //  even with this dimensions 30 runs can lead to freeze!
    
        try {
            const imageData = await ImageUtils.loadImage(this.currentImages[testType]);
            
            // Run BOTH tests simultaneously so you can see which finishes first
            // TODO: figure out why at the first execution of the test, wasm ui and only ui is slower than js
            // wasm ui rerendering is slower although according to metrics its faster 
            const [jsMedian, wasmMedian] = await Promise.all([
                this.runWithCountdown(testType, 'js', testItem, imageData, RUNS),
                this.runWithCountdown(testType, 'wasm', testItem, imageData, RUNS)
            ]);
            
            // Store results after both complete
            this.benchmark.storeResults(testType, 'js', jsMedian);
            this.benchmark.storeResults(testType, 'wasm', wasmMedian);
    
            this.ui.updateChart(testType);
            
            // verification should be done only for one run, because all runs are done using the same algorithm and image
            // input and output of run1 should be identical to run2 output and so on
            const isIdentical = await this.benchmark.verifyResults(testType);
            this.ui.showVerificationBadge(testType, isIdentical);
    
        } catch (error) {
            console.error('Test failed:', error);
            this.ui.showError(testType, error.message);
        } finally {
            button.disabled = false;
            button.textContent = '▶ Run Complete Test';
        }
    }

    getMedianMetrics(metricsArray) {
        // Sort by execution time and take middle value, for the runs
        const sorted = [...metricsArray].sort((a, b) => a.executionTime - b.executionTime);
        const median = sorted[Math.floor(sorted.length / 2)];
        return median;
    }

    // right now it is a messy approach, it works fine for test 1, but i need to improve it
    // what really annoys me is that i have here calling measurePerformance from benchmark class,
    // at the same itme benchmark class has methods for running tests, so there is stupid handling
    // for this time it is okay, but in future i need definitely to refactor it
    // TODO:
    async runWithCountdown(testType, processorType, testItem, imageData, runs) {
        const side = processorType === 'js' ? 'js' : 'wasm';
        const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
        const countdown = container.querySelector('.countdown-overlay');
        const actualImage = container.querySelector('.actual-image');
        
        // Show "start"
        countdown.classList.add('active');
        container.classList.add('processing');
        countdown.textContent = 'start';
        // in order for people to see start text
        await this.delay(1000);

        // Show "executing" and RUN THE ACTUAL TESTS
        countdown.textContent = `executing`;
        
        const metricsArray = [];
        for (let i = 0; i < runs; i++) {
            // Show run number
            countdown.textContent = `run ${i + 1}/${runs}`;
            
            // ACTUALLY EXECUTE HERE
            const metrics = await this.benchmark.measurePerformance(testType, processorType, imageData);
            metricsArray.push(metrics);
            
            await this.delay(50); // Small delay between runs, just to make UI a bit smoother
        }
        
        // Calculate median
        const medianMetrics = this.getMedianMetrics(metricsArray);
        
        countdown.textContent = 'complete';
        const dataUrl = ImageUtils.imageDataToDataURL(medianMetrics.processedImageData);
        actualImage.src = dataUrl;
        
        await this.delay(800);
        
        // Hide countdown
        countdown.classList.remove('active');
        container.classList.remove('processing');
        
        return medianMetrics; // Return for storage
    }
    
    handleMetricChange(event) {
        const tab = event.target;
        const testItem = tab.closest('.test-item');
        const testType = testItem.dataset.test;
        
        // Update active tab
        testItem.querySelectorAll('.metric-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update chart
        const metric = tab.dataset.metric;
        this.ui.updateChart(testType, metric);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}