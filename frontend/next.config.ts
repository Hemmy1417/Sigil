import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in the user home dir otherwise
  // makes Turbopack infer the wrong root and break route discovery in dev.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
