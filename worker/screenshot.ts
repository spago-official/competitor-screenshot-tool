import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

export interface ScreenshotResult {
  success: boolean;
  imagePath?: string;
  title?: string;
  url: string;
  error?: string;
}

const SCREENSHOT_VIEWPORT = {
  width: 1440,
  height: 900,
};

const PAGE_TIMEOUT = 60000; // 60秒（タイムアウト延長）

// Miro仕様に基づく制限
const MAX_FILE_SIZE_MB = 30; // 最大ファイルサイズ: 30MB
const MAX_WIDTH = 8192; // 最大幅: 8192px
const MAX_HEIGHT = 4096; // 最大高さ: 4096px
const MAX_RESOLUTION = 32_000_000; // 最大解像度: 32MP (32,000,000ピクセル)

// 画像を最適化する関数（Miro対応）
async function optimizeImage(imagePath: string): Promise<void> {
  const stats = await fs.stat(imagePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const resolution = width * height;

  // Miro制限チェック
  const exceedsFileSize = fileSizeMB > MAX_FILE_SIZE_MB;
  const exceedsWidth = width > MAX_WIDTH;
  const exceedsHeight = height > MAX_HEIGHT;
  const exceedsResolution = resolution > MAX_RESOLUTION;

  // 制限内なら何もしない
  if (!exceedsFileSize && !exceedsWidth && !exceedsHeight && !exceedsResolution) {
    console.log(`  Image: ${width}×${height} (${(resolution / 1_000_000).toFixed(1)}MP), ${fileSizeMB.toFixed(2)}MB (OK)`);
    return;
  }

  // 制限超過の理由をログ出力
  const reasons = [];
  if (exceedsFileSize) reasons.push(`size: ${fileSizeMB.toFixed(2)}MB > ${MAX_FILE_SIZE_MB}MB`);
  if (exceedsWidth) reasons.push(`width: ${width}px > ${MAX_WIDTH}px`);
  if (exceedsHeight) reasons.push(`height: ${height}px > ${MAX_HEIGHT}px`);
  if (exceedsResolution) reasons.push(`resolution: ${(resolution / 1_000_000).toFixed(1)}MP > ${MAX_RESOLUTION / 1_000_000}MP`);

  console.log(`  Image exceeds Miro limits (${reasons.join(', ')}), optimizing...`);

  try {
    let resizeNeeded = exceedsWidth || exceedsHeight || exceedsResolution;

    if (resizeNeeded) {
      // リサイズ計算
      let targetWidth = width;
      let targetHeight = height;

      // 幅・高さの制限に合わせる
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const widthRatio = MAX_WIDTH / width;
        const heightRatio = MAX_HEIGHT / height;
        const ratio = Math.min(widthRatio, heightRatio);
        targetWidth = Math.floor(width * ratio);
        targetHeight = Math.floor(height * ratio);
      }

      // 解像度の制限に合わせる
      if (targetWidth * targetHeight > MAX_RESOLUTION) {
        const resolutionRatio = Math.sqrt(MAX_RESOLUTION / (targetWidth * targetHeight));
        targetWidth = Math.floor(targetWidth * resolutionRatio);
        targetHeight = Math.floor(targetHeight * resolutionRatio);
      }

      await image
        .resize(targetWidth, targetHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({
          quality: 85,
          compressionLevel: 9,
        })
        .toFile(imagePath + '.tmp');
    } else {
      // リサイズ不要な場合は圧縮のみ
      await image
        .png({
          quality: 85,
          compressionLevel: 9,
        })
        .toFile(imagePath + '.tmp');
    }

    // 元のファイルと入れ替え
    await fs.unlink(imagePath);
    await fs.rename(imagePath + '.tmp', imagePath);

    // 最適化後の情報を表示
    const newStats = await fs.stat(imagePath);
    const newSizeMB = newStats.size / (1024 * 1024);
    const newImage = sharp(imagePath);
    const newMetadata = await newImage.metadata();
    const newWidth = newMetadata.width || 0;
    const newHeight = newMetadata.height || 0;
    const newResolution = newWidth * newHeight;

    console.log(`  Optimized: ${width}×${height} (${fileSizeMB.toFixed(2)}MB) → ${newWidth}×${newHeight} (${newSizeMB.toFixed(2)}MB)`);
  } catch (error: any) {
    console.error(`  Failed to optimize image: ${error.message}`);
    // 最適化に失敗しても元の画像は保持
  }
}

export async function captureScreenshot(
  url: string,
  outputDir: string,
  slug: string
): Promise<ScreenshotResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // ディレクトリ作成
    await fs.mkdir(outputDir, { recursive: true });

    // ブラウザ起動
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: SCREENSHOT_VIEWPORT,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    page = await context.newPage();

    // ページに移動（まずdomcontentloadedで待つ）
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_TIMEOUT,
    });

    // ネットワークがアイドルになるまで待つ（ベストエフォート）
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // 10秒でタイムアウトしても続行
    }

    // さらに少し待機（JavaScriptの実行を待つ）
    await page.waitForTimeout(5000);

    // ローディングスピナーが消えるまで待つ（ベストエフォート）
    try {
      // よくあるローディング要素を待つ
      await page.waitForFunction(
        () => {
          // ローディングスピナーやオーバーレイを探す
          const loadingElements = document.querySelectorAll(
            '[class*="loading"], [class*="spinner"], [class*="loader"], [id*="loading"], [id*="spinner"]'
          );

          // 表示されているローディング要素がないかチェック
          for (const el of Array.from(loadingElements)) {
            const style = window.getComputedStyle(el as Element);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              return false; // まだローディング中
            }
          }

          return true; // ローディング完了
        },
        { timeout: 5000 }
      );
    } catch {
      // タイムアウトしても続行
    }

    // クッキーバナーの簡易的な自動クリック（ベストエフォート）
    try {
      const cookieSelectors = [
        'button:has-text("Accept")',
        'button:has-text("同意")',
        'button:has-text("承諾")',
        '[class*="cookie"] button',
        '[id*="cookie"] button',
      ];

      for (const selector of cookieSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
          await button.click({ timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(500);
          break;
        }
      }
    } catch {
      // クッキーバナーが見つからない場合は無視
    }

    // ページタイトル取得
    const title = await page.title();

    // スクリーンショット撮影
    const imagePath = path.join(outputDir, `${slug}.png`);
    await page.screenshot({
      path: imagePath,
      fullPage: true,
    });

    // 画像を最適化（Miro対応）
    await optimizeImage(imagePath);

    // メタデータ保存
    const metaPath = path.join(outputDir, `${slug}.json`);
    const metadata = {
      url,
      title,
      capturedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    await context.close();
    await browser.close();

    return {
      success: true,
      imagePath,
      title,
      url,
    };
  } catch (error: any) {
    console.error(`Screenshot failed for ${url}:`, error.message);

    // クリーンアップ
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});

    return {
      success: false,
      url,
      error: error.message || 'Unknown error',
    };
  }
}

// URLからslugを生成（URLベースのファイル名、番号なし）
export function generateSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const pathname = urlObj.pathname
      .replace(/\/$/, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 50);

    // URLベースの名前（番号なし）
    const slug = pathname ? `${hostname}_${pathname}` : hostname;

    // 同じURLが複数ある場合に備えて、タイムスタンプを追加
    const timestamp = Date.now();
    return `${slug}_${timestamp}`;
  } catch {
    const timestamp = Date.now();
    return `invalid_url_${timestamp}`;
  }
}

// ドメイン名を取得
export function getDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'invalid_domain';
  }
}
