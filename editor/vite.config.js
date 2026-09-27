import {defineConfig} from 'vite';
export default defineConfig({worker:{format:'es'},server:{host:'0.0.0.0',allowedHosts:['terminal.local'],port:4173},build:{chunkSizeWarningLimit:2000,rollupOptions:{input:{main:'index.html',pdf:'pdf.html'}}},optimizeDeps:{exclude:['onnxruntime-web']}});
