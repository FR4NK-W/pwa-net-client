var wasm_loaded = undefined;
const go = new Go();
WebAssembly.instantiateStreaming(fetch("wasm_dsa.wasm"), go.importObject).then((result) => {
        go.run(result.instance);
        wasm_loaded = true;
});
