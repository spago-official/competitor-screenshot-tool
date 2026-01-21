import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/collections/[id] - Collection詳細取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        targetUrls: {
          orderBy: { createdAt: 'asc' },
          include: {
            screenshots: true,
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

    // 統計情報を追加
    const total = collection.targetUrls.length;
    const done = collection.targetUrls.filter(u => u.status === 'DONE').length;
    const failed = collection.targetUrls.filter(u => u.status === 'FAILED').length;
    const pending = collection.targetUrls.filter(
      u => u.status === 'PENDING' || u.status === 'RUNNING'
    ).length;

    return NextResponse.json({
      ...collection,
      stats: {
        total,
        done,
        failed,
        pending,
      },
    });
  } catch (error) {
    console.error('Failed to fetch collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    );
  }
}
