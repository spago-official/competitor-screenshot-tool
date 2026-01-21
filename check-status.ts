import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  console.log('📊 Database Status:\n');

  // TargetUrlの状態
  const targetUrls = await prisma.targetUrl.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log('TargetUrl Status:');
  targetUrls.forEach(({ status, _count }) => {
    console.log(`  ${status}: ${_count}`);
  });

  // Jobの状態
  const jobs = await prisma.job.groupBy({
    by: ['status'],
    _count: true,
  });

  console.log('\nJob Status:');
  jobs.forEach(({ status, _count }) => {
    console.log(`  ${status}: ${_count}`);
  });

  // PENDINGだがJobがないTargetUrl
  const pendingWithoutJob = await prisma.targetUrl.findMany({
    where: {
      status: 'PENDING',
      jobs: {
        none: {},
      },
    },
    select: {
      id: true,
      url: true,
    },
  });

  if (pendingWithoutJob.length > 0) {
    console.log(`\n⚠️  ${pendingWithoutJob.length} URLs are PENDING but have no Jobs:`);
    pendingWithoutJob.forEach(({ url }) => {
      console.log(`  - ${url}`);
    });
  } else {
    console.log('\n✅ All PENDING URLs have Jobs');
  }

  await prisma.$disconnect();
}

checkStatus().catch(console.error);
