import IORedis from 'ioredis';

let connection: IORedis | null = null;

export function isQueueConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisConnection(): IORedis {
  if (!process.env.REDIS_URL) {
    throw new Error(
      'REDIS_URL is required for BullMQ. Use Upstash Redis TCP URL (rediss://...).'
    );
  }

  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return connection;
}

export async function closeRedisConnection() {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
