import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["starknet", "get-starknet-core"],
  turbopack: {
    resolveAlias: {
      "@hyperlane-xyz/registry": "./src/empty.mjs",
      "@hyperlane-xyz/sdk":      "./src/empty.mjs",
      "@hyperlane-xyz/utils":    "./src/empty.mjs",
      "@fatsolutions/tongo-sdk": "./src/empty.mjs",
    },
  },
};

export default nextConfig;
