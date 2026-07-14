import type { NextConfig } from "next";

const isCloudflarePages = process.env.DEPLOY_TARGET === 'cloudflare-pages';

const serverSecurityConfig: NextConfig = isCloudflarePages
  ? {}
  : {
      async headers() {
        return [
          {
            source: '/(.*)',
            headers: [
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              { key: 'X-Frame-Options', value: 'DENY' },
              { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
          },
        ];
      },
    };

const nextConfig: NextConfig = {
  ...serverSecurityConfig,
  output: isCloudflarePages ? 'export' : 'standalone',
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  poweredByHeader: false,
  trailingSlash: isCloudflarePages,
};

export default nextConfig;
