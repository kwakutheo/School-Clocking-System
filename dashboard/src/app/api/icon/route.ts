import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';


// Hex → { r, g, b }
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/[^a-fA-F0-9]/g, '').slice(0, 6).padEnd(6, '0');
  const int = parseInt(cleaned, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

let cachedLogoBuffer: Buffer | null = null;

async function getLogoBuffer(): Promise<Buffer> {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  cachedLogoBuffer = await readFile(logoPath);
  return cachedLogoBuffer;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Parse & sanitise params ──────────────────────────────────────────────
    const rawColor = searchParams.get('color') ?? '3b82f6';
    const color = rawColor.replace(/[^a-fA-F0-9]/g, '').slice(0, 6) || '3b82f6';
    const { r, g, b } = hexToRgb(color);

    const rawSize = parseInt(searchParams.get('size') ?? '192', 10);
    // Only allow standard PWA icon sizes
    const size = [192, 512].includes(rawSize) ? rawSize : 192;

    const purpose = searchParams.get('purpose') === 'any' ? 'any' : 'maskable';

    const ringWidth = Math.round(size * 0.085);   // 8.5% per side
    const innerSize = size - ringWidth * 2;

    const logoBuffer = await getLogoBuffer();
    // fit: 'contain' keeps the logo's aspect ratio and adds transparent
    // padding to fill the square if the source is not square.
    const resizedLogo = await sharp(logoBuffer)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const radius = purpose === 'any' ? Math.round(size * 0.22) : 0;
    const backgroundSvg = Buffer.from(
      `<svg width="${size}" height="${size}">
         <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#${color}" />
       </svg>`
    );

    const finalBuffer = await sharp(backgroundSvg)
      .composite([
        {
          input: resizedLogo,
          top: ringWidth,
          left: ringWidth,
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new NextResponse(new Uint8Array(finalBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        // Cache for 24h at the CDN/browser level; allow serving stale for
        // up to 7 days while revalidating in the background. The color param
        // is part of the URL so different colors get their own cache entries.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (err) {
    console.error('[/api/icon] Failed to generate icon:', err);

    // Fallback: serve the static 192x192 icon so PWA install never breaks
    try {
      const fallback = await readFile(
        path.join(process.cwd(), 'public', 'icons', 'icon-192x192.png')
      );
      return new NextResponse(new Uint8Array(fallback), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    } catch {
      return new NextResponse('Icon generation failed', { status: 500 });
    }
  }
}
