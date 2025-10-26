// Main application entry point
import { UI } from './ui.js';
import { Benchmark } from './benchmark.js';
import { ImageUtils } from './utils.js';
import { CONFIG } from './config.js';

/**
 * Main Application Controller
 */
class App {
    constructor() {
        this.ui = new UI();
        this.benchmark = new Benchmark(this.ui);
        this.currentImages = {};
        this.init();
    }

    init() {
        console.log('WebAssembly vs JavaScript Benchmark initialized');
        console.log('Configuration:', CONFIG);
        this.setupEventListeners();
    }

    /**
     * Setup all event listeners
     */
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
/**
 * Handle file upload and validation
 */
async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const testType = event.target.dataset.test;
    
    // Validate file
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert('Please upload a valid image or video file');
        return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        alert('File too large. Please upload an image smaller than 50MB');
        return;
    }

    try {
        let dataUrl;
        
        // Store file/URL
        if (file.type.startsWith('video/')) {
            // For videos, we store the file directly
            this.currentImages[testType] = {
                data: file,
                hash: 'video-' + Date.now(),
                filename: file.name,
                size: file.size,
                dimensions: null,
                isVideo: true
            };
            await this.ui.showVideoPreview(testType, file);
        } else {
            // For images, convert to dataURL and generate hash
            dataUrl = await this.readFileAsDataURL(file);
            const imageHash = await this.generateImageHash(dataUrl);
            
            this.currentImages[testType] = {
                data: dataUrl,
                hash: imageHash,
                filename: file.name,
                size: file.size,
                dimensions: null,
                isVideo: false
            };
            await this.ui.showImagePreview(testType, dataUrl);
        }

        // Enable run button
        this.ui.enableRunButton(testType);
    } catch (error) {
        console.error('File upload failed:', error);
        alert('Failed to load file. Please try another image.');
    }
}

/**
 * Generate simple hash from image data
 */
async generateImageHash(dataUrl) {
    const img = await ImageUtils.loadImage(dataUrl);
    let hash = 0;
    for (let i = 0; i < Math.min(400, img.data.length); i++) {
        hash = ((hash << 5) - hash) + img.data[i];
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * Handle test execution
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
        
        const runs = this.getRunCount(imageData);
        
        console.log(`Running ${runs} iterations for ${testType}`);
        console.log(`Image size: ${imageData.width}x${imageData.height} (${(imageData.width * imageData.height / 1_000_000).toFixed(2)} MP)`);
        
        // Run both tests
        await this.benchmark.runComparison(testType, imageData, runs);
        
        // Update chart with default metric and reset tabs
        this.ui.updateChart(testType, 'time');
        this.ui.setActiveMetricTab(testType, 'time');
        
        // Verify that results are identical
        const isIdentical = await this.benchmark.verifyResults(testType);
        this.ui.showVerificationBadge(testType, isIdentical);
        
        if (!isIdentical) {
            console.warn('JS and WASM results differ! This may indicate a bug.');
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        this.ui.showError(testType, error.message || 'Test execution failed');
    } finally {
        // Re-enable button
        this.ui.setButtonRunning(testType, false);
    }
}

    /**
     * Handle metric tab change
     */
    handleMetricChange(event) {
        const tab = event.target;
        const testItem = tab.closest('.test-item');
        const testType = testItem.dataset.test;
        const metric = tab.dataset.metric;
        
        // Update active tab styling
        testItem.querySelectorAll('.metric-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update chart with new metric
        this.ui.updateChart(testType, metric);
    }

    getRunCount(imageData) {
        const megapixels = (imageData.width * imageData.height) / 1_000_000;
        
        if (megapixels < CONFIG.RUNS.SMALL_IMAGE_THRESHOLD) {
            return CONFIG.RUNS.SMALL_IMAGE_RUNS;
        }
        if (megapixels < CONFIG.RUNS.MEDIUM_IMAGE_THRESHOLD) {
            return CONFIG.RUNS.MEDIUM_IMAGE_RUNS;
        }
        return CONFIG.RUNS.LARGE_IMAGE_RUNS;
    }

    /**
     * Read file as Data URL
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            new App();
        } catch (error) {
            console.error('Application initialization failed:', error);
            alert('Failed to initialize application. Please check console for details.');
        }
    });
} else {
    new App();
}