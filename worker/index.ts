import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { captureScreenshot, generateSlug, getDomainName } from './screenshot';

const prisma = new PrismaClient();

const POLL_INTERVAL = 3000; // 3秒ごとにポーリング
const MAX_CONCURRENT = 2; // 同時実行数
const RETRY_LIMIT = 2; // 最大リトライ回数（エラー対策で増加）

let isShuttingDown = false;
let activeJobs = 0;

async function processJob(jobId: string) {
  activeJobs++;

  try {
    // Jobを取得（PENDING状態のもののみ）
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        status: 'PENDING',
      },
      include: {
        targetUrl: {
          include: {
            collection: true,
          },
        },
      },
    });

    if (!job) {
      console.log(`Job ${jobId} not found or already processed`);
      return;
    }

    // JobをRUNNINGに更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        attempts: job.attempts + 1,
      },
    });

    // TargetUrlをRUNNINGに更新
    await prisma.targetUrl.update({
      where: { id: job.targetUrlId },
      data: { status: 'RUNNING' },
    });

    const { targetUrl } = job;
    const { collection } = targetUrl;

    // 出力ディレクトリ
    const domainName = getDomainName(targetUrl.url);
    const outputDir = path.join(
      process.cwd(),
      'data',
      'collections',
      collection.id,
      domainName
    );

    // スクリーンショット撮影
    const slug = generateSlug(targetUrl.url);

    console.log(`Processing: ${targetUrl.url}`);

    const result = await captureScreenshot(targetUrl.url, outputDir, slug);

    if (result.success && result.imagePath) {
      // 成功：Screenshotレコード作成
      await prisma.screenshot.create({
        data: {
          collectionId: collection.id,
          targetUrlId: targetUrl.id,
          imagePath: result.imagePath,
          title: result.title || null,
          url: targetUrl.url,
        },
      });

      // TargetUrlをDONEに更新
      await prisma.targetUrl.update({
        where: { id: targetUrl.id },
        data: {
          status: 'DONE',
          errorMessage: null,
        },
      });

      // JobをDONEに更新
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'DONE' },
      });

      console.log(`✓ Success: ${targetUrl.url}`);
    } else {
      // 失敗：リトライ判定
      const shouldRetry = job.attempts < RETRY_LIMIT;

      if (shouldRetry) {
        // リトライ
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            lastError: result.error || 'Unknown error',
          },
        });

        await prisma.targetUrl.update({
          where: { id: targetUrl.id },
          data: { status: 'PENDING' },
        });

        console.log(`⟳ Retry scheduled: ${targetUrl.url}`);
      } else {
        // リトライ上限に達した：FAILED
        await prisma.targetUrl.update({
          where: { id: targetUrl.id },
          data: {
            status: 'FAILED',
            errorMessage: result.error || 'Unknown error',
          },
        });

        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            lastError: result.error || 'Unknown error',
          },
        });

        console.log(`✗ Failed: ${targetUrl.url} - ${result.error}`);
      }
    }
  } catch (error: any) {
    console.error(`Job processing error (${jobId}):`, error.message);

    // ジョブをFAILEDに更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        lastError: error.message || 'Unknown error',
      },
    });
  } finally {
    activeJobs--;
  }
}

async function pollJobs() {
  if (isShuttingDown) {
    return;
  }

  try {
    // 同時実行数を超えていたらスキップ
    if (activeJobs >= MAX_CONCURRENT) {
      return;
    }

    // PENDINGのJobを取得
    const availableSlots = MAX_CONCURRENT - activeJobs;
    const jobs = await prisma.job.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: availableSlots,
    });

    if (jobs.length === 0) {
      return;
    }

    // 並列処理
    await Promise.all(jobs.map(job => processJob(job.id)));
  } catch (error: any) {
    console.error('Poll error:', error.message);
  }
}

async function main() {
  console.log('🚀 Worker started');
  console.log(`Polling interval: ${POLL_INTERVAL}ms`);
  console.log(`Max concurrent jobs: ${MAX_CONCURRENT}`);

  // ポーリングループ
  const intervalId = setInterval(pollJobs, POLL_INTERVAL);

  // シグナルハンドリング
  process.on('SIGINT', async () => {
    console.log('\n⏸ Shutting down gracefully...');
    isShuttingDown = true;
    clearInterval(intervalId);

    // アクティブなジョブが完了するまで待機
    while (activeJobs > 0) {
      console.log(`Waiting for ${activeJobs} active job(s) to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await prisma.$disconnect();
    console.log('✓ Worker stopped');
    process.exit(0);
  });

  // 初回ポーリング
  await pollJobs();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
