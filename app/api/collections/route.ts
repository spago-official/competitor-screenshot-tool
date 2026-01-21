import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/collections - Collection一覧取得
export async function GET() {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        targetUrls: {
          select: {
            status: true,
          },
        },
      },
    });

    // 各Collectionの統計情報を付与
    const collectionsWithStats = collections.map(collection => {
      const total = collection.targetUrls.length;
      const done = collection.targetUrls.filter(u => u.status === 'DONE').length;
      const failed = collection.targetUrls.filter(u => u.status === 'FAILED').length;
      const pending = collection.targetUrls.filter(
        u => u.status === 'PENDING' || u.status === 'RUNNING'
      ).length;

      return {
        id: collection.id,
        title: collection.title,
        queryText: collection.queryText,
        status: collection.status,
        createdAt: collection.createdAt,
        stats: {
          total,
          done,
          failed,
          pending,
        },
      };
    });

    return NextResponse.json(collectionsWithStats);
  } catch (error) {
    console.error('Failed to fetch collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}

// POST /api/collections - Collection作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryText } = body;

    if (!queryText || typeof queryText !== 'string') {
      return NextResponse.json(
        { error: 'queryText is required' },
        { status: 400 }
      );
    }

    // 英数字、ハイフン、アンダースコアのみ許可
    const validPattern = /^[a-zA-Z0-9-_]+$/;
    if (!validPattern.test(queryText.trim())) {
      return NextResponse.json(
        { error: 'Collection name must contain only alphanumeric characters, hyphens, and underscores' },
        { status: 400 }
      );
    }

    // Collection作成
    const collection = await prisma.collection.create({
      data: {
        title: queryText,
        queryText,
        status: 'DONE',
      },
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    console.error('Failed to create collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}
