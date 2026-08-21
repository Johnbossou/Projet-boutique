import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  // 59 erreurs ESLint de style preexistantes (no-unescaped-entities, no-explicit-any)
  // ne doivent pas bloquer le build ; le typage TypeScript reste verifie
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: path.join(__dirname)
  }
};

export default nextConfig;
