const Queue = require('bull');

// Use environment variables with fallbacks
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

console.log(`[Queue] Attempting to connect to Redis at ${REDIS_HOST}:${REDIS_PORT}`);

// Fixed configuration - removed problematic options for Bull
const bookingQueue = new Queue('bookingQueue', {
  redis: { 
    host: REDIS_HOST,
    port: REDIS_PORT,
    // REMOVED: maxRetriesPerRequest - causes issues with Bull's subscriber
    // REMOVED: enableReadyCheck - causes issues with Bull's subscriber
    retryDelayOnFailover: 100,
    maxLoadingTimeout: 0,
    connectTimeout: 30000,           // 30 seconds
    lazyConnect: false,              // Connect immediately
    keepAlive: 30000,
    family: 4,                       // Force IPv4
    // Enhanced retry strategy
    retryStrategy: (times) => {
      if (times > 10) {
        console.error(`[Redis] Max connection attempts reached (${times})`);
        return null; // Stop retrying after 10 attempts
      }
      const delay = Math.min(times * 1000, 5000); // Max 5 second delay
      console.log(`[Redis] Connection attempt ${times}, retrying in ${delay}ms...`);
      return delay;
    }
  },
  settings: {
    stalledInterval: 30 * 1000,      // Check for stalled jobs every 30s
    maxStalledCount: 1,              // Retry stalled jobs once
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

// Alternative approach - if you need more control over Redis clients
// Uncomment this section if the simple fix above doesn't work:

/*
const Redis = require('ioredis');

// Create separate Redis instances for different Bull clients
const createRedisClient = (type) => {
  const baseConfig = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    retryDelayOnFailover: 100,
    maxLoadingTimeout: 0,
    connectTimeout: 30000,
    lazyConnect: false,
    keepAlive: 30000,
    family: 4,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 5000);
    }
  };

  switch (type) {
    case 'client':
      return new Redis({
        ...baseConfig,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });
    case 'subscriber':
      return new Redis({
        ...baseConfig,
        enableReadyCheck: false,
        maxRetriesPerRequest: null
      });
    default:
      return new Redis(baseConfig);
  }
};

const bookingQueue = new Queue('bookingQueue', {
  createClient: createRedisClient,
  settings: {
    stalledInterval: 30 * 1000,
    maxStalledCount: 1,
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});
*/

// Connection event handlers
bookingQueue.on('error', (error) => {
  console.error('[bookingQueue] ❌ Redis error:', error.message);
  console.error('[bookingQueue] Error code:', error.code);
  if (error.stack) {
    console.error('[bookingQueue] Error stack:', error.stack);
  }
});

bookingQueue.on('waiting', (jobId) => {
  console.log(`[bookingQueue] ⏳ Job ${jobId} is waiting`);
});

bookingQueue.on('ready', () => {
  console.log('[bookingQueue] ✅ Connected to Redis and ready to process jobs!');
});

bookingQueue.on('connect', () => {
  console.log(`[bookingQueue] 🔗 Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
});

bookingQueue.on('disconnect', () => {
  console.log('[bookingQueue] 🔌 Disconnected from Redis server');
});

bookingQueue.on('reconnecting', () => {
  console.log('[bookingQueue] 🔄 Reconnecting to Redis...');
});

// Test connection function
async function testConnection() {
  try {
    console.log('[bookingQueue] Testing connection...');
    // Wait a bit for connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const client = bookingQueue.client;
    const result = await client.ping();
    console.log('[bookingQueue] ✅ Redis ping successful:', result);
    return true;
  } catch (error) {
    console.error('[bookingQueue] ❌ Redis ping failed:', error.message);
    return false;
  }
}

// Export the queue (keeping same export structure as your worker expects)
module.exports = bookingQueue;

// Also export test function if needed
module.exports.testConnection = testConnection;