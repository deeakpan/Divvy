import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Pin app root so a parent-folder lockfile does not steal `public/` (e.g. /divvy.png 404, broken favicon). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["starknet"],
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      "@hyperlane-xyz/registry": "./src/empty.mjs",
      "@hyperlane-xyz/sdk":      "./src/empty.mjs",
      "@hyperlane-xyz/utils":    "./src/empty.mjs",
      "@fatsolutions/tongo-sdk": "./src/empty.mjs",
    },
  },
};

export default nextConfig;
