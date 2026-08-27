import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },

  // Hide Next.js development indicator
  // devIndicators: false,
};

export default nextConfig;
