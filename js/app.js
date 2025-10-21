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
                document.querySelector(`.hidden-file-input[data-test="${testType}"]`).click();
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
        
        // Validate file
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Please upload a valid image or video file');
            return;
        }

        // Store file/URL
        if (file.type.startsWith('video/')) {
            this.currentImages[testType] = file;
            await this.ui.showVideoPreview(testType, file);
        } else {
            const dataUrl = await this.readFileAsDataURL(file);
            this.currentImages[testType] = dataUrl;
            await this.ui.showImagePreview(testType, dataUrl);
        }

        // Enable button
        this.ui.enableRunButton(testType);
    }

    async handleRunTest(event) {
        const testType = event.target.dataset.test;
        
        this.ui.setButtonRunning(testType, true);

        try {
            const imageData = await ImageUtils.loadImage(this.currentImages[testType]);
            // NOTE: determining runs can be as well based not only on image size, but also on something else, need to think about it
            const runs = this.getRunCount(imageData);
            
            // Run both tests (benchmark handles all the complexity)
            await this.benchmark.runComparison(testType, imageData, runs);
            
            // Show results
            this.ui.updateChart(testType);
            // verification should be done only for one run, because all runs are done using the same algorithm and image
            // input and output of run1 should be identical to run2 output and so on
            const isIdentical = await this.benchmark.verifyResults(testType);
            this.ui.showVerificationBadge(testType, isIdentical);
            
        } catch (error) {
            console.error('Test failed:', error);
            this.ui.showError(testType, error.message);
        } finally {
            this.ui.setButtonRunning(testType, false);
        }
    }

    handleMetricChange(event) {
        const tab = event.target;
        const testItem = tab.closest('.test-item');
        const testType = testItem.dataset.test;
        const metric = tab.dataset.metric;
        
        // Update active tab
        testItem.querySelectorAll('.metric-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.ui.updateChart(testType, metric);
    }

    getRunCount(imageData) {
        const megapixels = (imageData.width * imageData.height) / 1000000;
        if (megapixels < 4) return 30;
        if (megapixels < 25) return 10;
        return 3;
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}