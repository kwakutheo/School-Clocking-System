import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.152.203.141',
    '10.21.117.141',
    '*.localhost',
    '*.saas.localhost',
  ],
};

export default nextConfig;
