// Main application entry point
import { UI } from './ui.js';
import { Benchmark } from './benchmark.js';

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
        // Upload button listeners
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

        // Run test button listeners
        document.querySelectorAll('.run-test-button').forEach(button => {
            button.addEventListener('click', (e) => this.handleRunTest(e));
        });

        // Metric tab listeners
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
                            const offset = i * 35; // spacing between layers
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
        // Show batch preview for video
        const containers = testItem.querySelectorAll('.image-container');
        containers.forEach(container => {
            container.classList.add('has-image');
            const placeholder = container.querySelector('.image-placeholder');
            const batchPreview = container.querySelector('.batch-preview');
            
            placeholder.style.display = 'none';
            if (batchPreview) {
                batchPreview.classList.add('active');
                const layers = batchPreview.querySelectorAll('.batch-layer');
                layers.forEach((layer, i) => {
                    layer.style.backgroundImage = `url(${imageUrl})`;
                    layer.textContent = '';
                    layer.style.opacity = 5;
                    const offset = i * 35; // spacing between layers
                    layer.style.transform = `translate(${offset}px, ${offset}px)`;
                    layer.style.zIndex = layers.length - i;
                });                
            }
            
        });

        // Store video file for processing
        this.currentImages[testType] = file;
    }

    async handleRunTest(event) {
        const button = event.target;
        const testType = button.dataset.test;
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        
        // Disable button during execution
        button.disabled = true;
        button.textContent = '⏳ Running...';

        try {
            // Run JavaScript test with countdown
            await this.runWithCountdown(testType, 'js', testItem);
            
            // Small delay between tests
            await this.delay(1000);
            
            // Run WebAssembly test with countdown
            await this.runWithCountdown(testType, 'wasm', testItem);

            // Update chart with new results
            this.ui.updateChart(testType);

            // Verify results
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

    async runWithCountdown(testType, processorType, testItem) {
        const side = processorType === 'js' ? 'js' : 'wasm';
        const container = testItem.querySelector(`.image-container[data-side="${side}"]`);
        const countdown = container.querySelector('.countdown-overlay');
        
        // Show countdown
        countdown.classList.add('active');
        container.classList.add('processing');

        countdown.textContent = 'start';
        await this.delay(1000);

        countdown.textContent = 'execution';

        // Run the actual test
        await this.benchmark.runTest(testType, processorType, this.currentImages[testType]);

        // Hide countdown
        countdown.classList.remove('active');
        container.classList.remove('processing');
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