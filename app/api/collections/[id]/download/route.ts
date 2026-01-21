import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

// GET /api/collections/[id]/download - ZIPダウンロード
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Collection取得
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        screenshots: {
          include: {
            targetUrl: true,
          },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.screenshots.length === 0) {
      return NextResponse.json(
        { error: 'No screenshots available for this collection' },
        { status: 404 }
      );
    }

    // ZIP生成
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // エラーハンドリング
    archive.on('error', err => {
      console.error('Archive error:', err);
      throw err;
    });

    // index.jsonを作成（メタデータ一覧）
    const indexData = collection.screenshots.map(screenshot => ({
      url: screenshot.url,
      title: screenshot.title,
      capturedAt: screenshot.capturedAt,
      imagePath: screenshot.imagePath,
      source: screenshot.targetUrl.source,
    }));

    archive.append(JSON.stringify(indexData, null, 2), {
      name: 'index.json',
    });

    // StreamをReadableStreamに変換（先に設定）
    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        archive.on('end', () => {
          controller.close();
        });

        archive.on('error', (err: Error) => {
          console.error('Stream error:', err);
          controller.error(err);
        });
      },
    });

    // 各スクリーンショットファイルを追加（PNGのみ）
    for (const screenshot of collection.screenshots) {
      // imagePathが相対パス（data/...）の場合は、process.cwd()を付ける
      // 絶対パスの場合はそのまま使う
      const absolutePath = path.isAbsolute(screenshot.imagePath)
        ? screenshot.imagePath
        : path.join(process.cwd(), screenshot.imagePath);

      // ファイル存在チェック
      if (fs.existsSync(absolutePath)) {
        // ファイル名だけを取得（フォルダ階層なし）
        const fileName = path.basename(absolutePath);
        archive.file(absolutePath, { name: fileName });
      } else {
        console.warn(`File not found: ${absolutePath}`);
      }
    }

    // アーカイブ終了
    archive.finalize();

    // レスポンスヘッダー設定
    const headers = new Headers();
    const sanitizedTitle = collection.title.replace(/[^a-zA-Z0-9-_]/g, '_');

    // 現在日時をフォーマット（YYYYMMDD_HHmmss形式）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const datetime = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    const filename = `${sanitizedTitle}_${datetime}.zip`;
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('Failed to generate ZIP:', error);
    return NextResponse.json(
      { error: 'Failed to generate ZIP file' },
      { status: 500 }
    );
  }
}
