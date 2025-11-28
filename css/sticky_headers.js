/**
 * Sticky Bottom Headers Controller
 * Shows test title at bottom of viewport when scrolling through test content
 */
class StickyHeadersController {
	constructor() {
		this.activeHeader = null;
		this.observers = new Map();
		this.init();
	}

	init() {
		// Wait for DOM to be ready
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => this.setupObservers());
		} else {
			this.setupObservers();
		}
	}

	setupObservers() {
		const testItems = document.querySelectorAll(".test-item");

		testItems.forEach((testItem) => {
			const testContent = testItem.querySelector(".test-content");
			const stickyHeader = testItem.querySelector(".hidden-sticky-header");

			if (!testContent || !stickyHeader) return;

			// Create observer for this test section
			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							// Show this header
							this.showHeader(stickyHeader);
						} else {
							// Hide this header
							this.hideHeader(stickyHeader);
						}
					});
				},
				{
					// Trigger when test content enters/exits viewport
					threshold: [0, 0.1],
					rootMargin: "-15% 0px -15% 0px",
				}
			);

			observer.observe(testContent);
			this.observers.set(testItem, observer);
		});
	}

	showHeader(header) {
		// Hide currently active header if different
		if (this.activeHeader && this.activeHeader !== header) {
			this.activeHeader.classList.remove("active");
		}

		// Show new header
		header.classList.add("active");
		this.activeHeader = header;
	}

	hideHeader(header) {
		// Only hide if this is the currently active header
		if (this.activeHeader === header) {
			header.classList.remove("active");
			this.activeHeader = null;
		}
	}

	destroy() {
		// Cleanup observers
		this.observers.forEach((observer) => observer.disconnect());
		this.observers.clear();
		this.activeHeader = null;
	}
}

// Initialize when script loads
const stickyHeadersController = new StickyHeadersController();

// Export for potential external use
export { StickyHeadersController };
