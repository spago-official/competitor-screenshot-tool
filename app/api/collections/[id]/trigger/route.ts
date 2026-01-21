import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // コレクションの存在確認
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        targetUrls: {
          where: {
            status: 'FAILED',
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

    // FAILEDのTargetUrlに対してJobを作成
    let jobsCreated = 0;
    for (const targetUrl of collection.targetUrls) {
      // 既存のPENDINGまたはRUNNINGのJobがあるか確認
      const existingJob = await prisma.job.findFirst({
        where: {
          targetUrlId: targetUrl.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      // 既存のJobがなければ新規作成し、TargetUrlをPENDINGに戻す
      if (!existingJob) {
        await prisma.targetUrl.update({
          where: { id: targetUrl.id },
          data: { status: 'PENDING', errorMessage: null },
        });

        await prisma.job.create({
          data: {
            targetUrlId: targetUrl.id,
            status: 'PENDING',
            attempts: 0,
          },
        });
        jobsCreated++;
      }
    }

    return NextResponse.json({
      message: `${jobsCreated}件のジョブを作成しました`,
      jobsCreated,
    });
  } catch (error) {
    console.error('Failed to trigger jobs:', error);
    return NextResponse.json(
      { error: 'Failed to trigger jobs' },
      { status: 500 }
    );
  }
}
