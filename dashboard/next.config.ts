import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({
  // Source SW file (TypeScript, compiled by serwist)
  swSrc: 'src/sw.ts',
  // Output path in public/ — served at /sw.js
  swDest: 'public/sw.js',
  // Disable in development to avoid SW caching interfering with hot reload
  disable: process.env.NODE_ENV === 'development',
  // Automatically register the SW on the client (handled manually in PwaRegister instead)
  // so we have fine-grained control over timing
  reloadOnOnline: true,
});

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

export default withSerwist(nextConfig);
