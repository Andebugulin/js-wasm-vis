# js-wasm-vis
A web app that visualizes fair performance comparisons between JavaScript and WebAssembly.

# Probable final project structure 

```
js-wasm-vis/
│
├── index.html                  # Main HTML entry point
│
├── css/
│   └── styles.css              # All styles (combined for simplicity, might be split later on)
│
├── js/
│   ├── app.js                  # Main app initialization
│   ├── ui.js                   # UI updates and DOM manipulation
│   ├── benchmark.js            # Benchmark coordination and timing
│   ├── js-processor.js         # JavaScript image processing (lazy loaded)
│   └── utils.js                # Utility funcitons like Image/file loading
│
├── wasm/
│   └── test[1]/                # Different test cases (can have multiple)
│       ├── wasm-build-test[1]/ # Compiled WASM module and JS glue code   
│       └── wasm-src-test[1]/   # Rust source code for WASM module
│           ├── Cargo.toml      # Cargo configuration
│           ├── Cargo.lock      # Cargo lock file
│           └── src/
│               └── lib.rs      # Rust source code 
└── assets/
    └── images/
        ├── test-image.jpg      # Test images, possibly add more
```

# Compiling wasm module from Rust

1. Install Rust and wasm-pack if you haven't already.
- to install rust, check https://www.rust-lang.org/tools/install
- to install wasm-pack, run `cargo install wasm-pack`
2. Navigate to the `wasm/test1/wasm-src-test1` directory, or other directories if you have multiple tests.
3. Run `wasm-pack build --target web --out-dir ../wasm-build-test1 
- Change the output directory as needed for different tests, in current setup it is `../wasm-build-test1`
4. If sequence of commands is correct, the compiled wasm module and JS glue code will be in `wasm/wasm-build-test1` directory, named `wasm_src_test1_bg.wasm` and `wasm_src_test1.js` respectively.


# Running the app

`python -m http.server 8000`

Then open `http://localhost:8000` in your browser.