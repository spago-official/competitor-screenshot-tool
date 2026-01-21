import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/collections/[id]/urls - URL手動追加
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'urls array is required' },
        { status: 400 }
      );
    }

    // Collectionの存在確認
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // URLの重複チェック
    const existingUrls = await prisma.targetUrl.findMany({
      where: {
        collectionId: id,
        url: { in: urls },
      },
      select: { url: true },
    });

    const existingUrlSet = new Set(existingUrls.map(u => u.url));
    const newUrls = urls.filter(url => !existingUrlSet.has(url));

    if (newUrls.length === 0) {
      return NextResponse.json({
        message: 'All URLs already exist',
        added: 0,
        skipped: urls.length,
      });
    }

    // TargetUrl作成
    const targetUrlsData = newUrls.map(url => ({
      collectionId: id,
      url,
      source: 'MANUAL',
      status: 'PENDING',
    }));

    await prisma.targetUrl.createMany({
      data: targetUrlsData,
    });

    // 作成されたTargetUrlを取得してJobを作成
    const createdTargetUrls = await prisma.targetUrl.findMany({
      where: {
        collectionId: id,
        url: { in: newUrls },
      },
    });

    const jobs = createdTargetUrls.map(targetUrl => ({
      targetUrlId: targetUrl.id,
      type: 'SCREENSHOT',
      status: 'PENDING',
    }));

    await prisma.job.createMany({
      data: jobs,
    });

    return NextResponse.json({
      message: 'URLs added successfully',
      added: newUrls.length,
      skipped: urls.length - newUrls.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to add URLs:', error);
    return NextResponse.json(
      { error: 'Failed to add URLs' },
      { status: 500 }
    );
  }
}
