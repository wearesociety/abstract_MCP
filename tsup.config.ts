import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";

export default defineConfig({
    entry: ["src/server.ts"],
    format: ["esm"],
    target: "es2022",
    dts: true,
    clean: true,
    loader: {
        ".json": "json",
    },
    // Copy JavaScript files from src/constants to dist/constants after build
    onSuccess: async () => {
        const srcDir = "src/constants";
        const destDir = "dist/constants";
        
        // Ensure destination directory exists
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }
        
        // Copy specific JavaScript files needed for deployment
        const filesToCopy = [
            "deployBasicToken.js",
            "ethers.js",
            "constants.js"
        ];
        
        for (const file of filesToCopy) {
            const srcPath = join(srcDir, file);
            const destPath = join(destDir, file);
            
            if (existsSync(srcPath)) {
                copyFileSync(srcPath, destPath);
                console.log(`Copied ${srcPath} to ${destPath}`);
            }
        }
    },
    // Handle CJS modules in ESM environment - include all problematic dependencies
    noExternal: [
        "ethers",
        "zksync-ethers",
        "ws",
        "stream",
        "crypto",
        "@abstract-foundation/agw-client"
    ],
    // Ensure proper ESM output
    splitting: false,
    sourcemap: true,
    // Handle Node.js built-ins
    platform: "node",
    // Bundle dependencies that might cause issues
    bundle: true,
    // Add Node.js polyfills for problematic modules
    define: {
        "global": "globalThis",
    },
    // Handle ESM/CJS compatibility
    esbuildOptions(options) {
        options.platform = "node";
        options.target = "es2022";
        // Add Node.js polyfills
        options.define = {
            ...options.define,
            "global": "globalThis",
        };
    },
}); 