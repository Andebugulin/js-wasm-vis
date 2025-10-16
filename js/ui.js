// UI updates and DOM manipulation
export class UI {
    constructor() {
        this.maxHistoryItems = 10;
    }

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

        // Get last 10 results
        const displayResults = results.slice(-this.maxHistoryItems);
        
        chartContainer.innerHTML = `
            <div class="chart-canvas">
                ${displayResults.map((result, index) => this.createChartGroup(result, index + 1, metric)).join('')}
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
        `;
    }

    createChartGroup(result, runNumber, metric) {
        const jsValue = this.getMetricValue(result.js, metric);
        const wasmValue = this.getMetricValue(result.wasm, metric);
        const maxValue = Math.max(jsValue, wasmValue);

        const jsHeight = (jsValue / maxValue) * 100;
        const wasmHeight = (wasmValue / maxValue) * 100;

        return `
            <div class="chart-group">
                <div class="chart-bars">
                    <div class="chart-bar" style="height: ${jsHeight}%">
                        <div class="bar-value">${jsValue.toFixed(2)}</div>
                    </div>
                    <div class="chart-bar wasm-bar" style="height: ${wasmHeight}%">
                        <div class="bar-value">${wasmValue.toFixed(2)}</div>
                    </div>
                </div>
                <div class="chart-label">Run ${runNumber}</div>
            </div>
        `;
    }

    getMetricValue(resultData, metric) {
        switch(metric) {
            case 'time': return resultData.executionTime;
            case 'memory': return resultData.memoryUsage;
            case 'freeze': return resultData.uiFreeze;
            default: return resultData.executionTime;
        }
    }

    getTestResults(testType) {
        // Retrieve from benchmark stored results
        const stored = sessionStorage.getItem(`results_${testType}`);
        return stored ? JSON.parse(stored) : [];
    }

    showVerificationBadge(testType, isIdentical) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const badge = testItem.querySelector('.verification-badge');
        
        if (badge && isIdentical) {
            badge.classList.add('active');
            badge.textContent = '✓ Results Verified Identical';
        } else if (badge) {
            badge.classList.add('active');
            badge.textContent = '⚠ Results Differ';
            badge.style.borderColor = 'rgba(255, 68, 68, 0.3)';
            badge.style.color = '#ff4444';
        }
    }

    showError(testType, message) {
        const testItem = document.querySelector(`[data-test="${testType}"]`);
        const chartContainer = testItem.querySelector('.chart-container');
        
        chartContainer.innerHTML = `
            <div class="empty-state" style="color: #ff4444;">
                Error: ${message}
            </div>
        `;
    }
}