# js-wasm-vis
A web app that visualizes fair performance comparisons between JavaScript and WebAssembly.

# Probable final project structure 

```
js-wasm-vis/
│
├── index.html                # Main HTML entry point
│
├── css/
│   └── styles.css            # All styles (combined for simplicity, might be split later on)
│
├── js/
│   ├── app.js                # Main app initialization
│   ├── ui.js                 # UI updates and DOM manipulation
│   ├── benchmark.js          # Benchmark coordination and timing
│   ├── js-processor.js       # JavaScript image processing (lazy loaded)
│   └── wasm-loader.js        # WebAssembly loader (lazy loaded)
│
├── wasm/
│   └── image_processor.wasm  # Compiled WASM module from Rust, possibly include source files from Rust later, don't know how I am going to manage that yet
│
└── assets/
    └── images/
        ├── test-image.jpg    # Test images, possibly add more
```
