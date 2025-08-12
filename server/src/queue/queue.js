const Queue = require('bull');

const bookingQueue = new Queue('bookingQueue', {
  redis: { 
    host: 'redis', // Use Docker service name instead of IP
    port: 6379,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    lazyConnect: true
  }
});

// Add connection event handlers for debugging
bookingQueue.on('error', (error) => {
  console.error('[bookingQueue] Redis connection error:', error);
});

bookingQueue.on('waiting', (jobId) => {
  console.log(`[bookingQueue] Job ${jobId} is waiting`);
});

module.exports = bookingQueue;