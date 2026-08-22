import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude firebase-admin and its Google Cloud transitive dependencies from
  // Turbopack/webpack bundling. They rely on Node.js built-ins and optional
  // packages (e.g. @opentelemetry/api) that a bundler cannot resolve.
  // Next.js will require them natively from node_modules at runtime instead.
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "@firebase/app",
    "google-auth-library",
    "googleapis-common",
  ],
};

export default nextConfig;
