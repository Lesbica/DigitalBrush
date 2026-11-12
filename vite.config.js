import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The components use JSX inside .js files (as in Create React App), so .js is compiled as JSX.
export default defineConfig({
    plugins: [react({ include: /\.(js|jsx)$/ })],
    esbuild: {
        loader: 'jsx',
        include: /src\/.*\.jsx?$/,
        exclude: [],
    },
    optimizeDeps: {
        esbuildOptions: { loader: { '.js': 'jsx' } },
    },
    server: { port: 3000, strictPort: true },
    preview: { port: 3000 },
    // same output folder as before, so the Docker image and nginx config stay unchanged
    build: { outDir: 'build', sourcemap: false },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/setupTests.js',
        include: ['src/**/*.test.{js,jsx}'],
        css: { modules: { classNameStrategy: 'non-scoped' } },
    },
});
