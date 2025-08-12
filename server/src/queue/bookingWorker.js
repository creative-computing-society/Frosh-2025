const mongoose = require('mongoose');
const bookingQueue = require('./queue');
const Event = require('../models/events.model');
const Pass = require('../models/passes.model');
require('dotenv').config();

// Improved Redis connection test function
async function testRedisConnection() {
  try {
    console.log('[bookingWorker] Testing Redis connection...');
    
    // Method 1: Try direct ping to Redis client
    try {
      const client = bookingQueue.client;
      const pingResult = await client.ping();
      console.log('[bookingWorker] ✅ Redis ping successful:', pingResult);
      return true;
    } catch (pingError) {
      console.log('[bookingWorker] Direct ping failed, trying queue ready check...', pingError.message);
    }

    // Method 2: Wait for queue ready event with timeout
    const isReady = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('[bookingWorker] ⏰ Redis ready timeout - continuing anyway...');
        resolve(false); // Don't reject, just continue
      }, 5000); // Reduced timeout to 5 seconds

      // Check if queue is already ready
      if (bookingQueue.client && bookingQueue.client.status === 'ready') {
        clearTimeout(timeout);
        console.log('[bookingWorker] ✅ Redis already ready');
        resolve(true);
        return;
      }

      bookingQueue.on('ready', () => {
        clearTimeout(timeout);
        console.log('[bookingWorker] ✅ Redis connection verified via ready event');
        resolve(true);
      });

      bookingQueue.on('error', (error) => {
        console.log('[bookingWorker] ⚠️ Redis error during connection test:', error.message);
        // Don't reject on error - let it continue and try to work
      });
    });

    return isReady;
  } catch (error) {
    console.error('[bookingWorker] ❌ Redis connection test failed:', error.message);
    return false;
  }
}

async function startWorker() {
  console.log('[bookingWorker] Starting worker process...');
  
  // Test Redis connection but don't fail if timeout
  const redisReady = await testRedisConnection();
  if (!redisReady) {
    console.warn('[bookingWorker] ⚠️ Redis connection test inconclusive, continuing anyway...');
    // Don't exit - let it try to work
  }

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("------------------------------------------------------");
    console.log('[bookingWorker] ✅ Connected to MongoDB');
  } catch (mongoError) {
    console.error('[bookingWorker] ❌ MongoDB connection failed:', mongoError);
    process.exit(1);
  }

  // Set up all event listeners BEFORE registering the processor
  bookingQueue.on('ready', () => {
    console.log('[bookingWorker] 🚀 Queue is ready to process jobs');
  });

  bookingQueue.on('error', (error) => {
    console.error('[bookingWorker] ❌ Queue error:', error.message);
    // Don't exit on queue errors - just log them
  });

  bookingQueue.on('waiting', (jobId) => {
    console.log(`[bookingQueue] ⏳ Job ${jobId} is waiting in queue`);
  });

  bookingQueue.on('active', (job) => {
    console.log(`[bookingQueue] 🔄 Job ${job.id} started processing - userId: ${job.data.userId}, eventId: ${job.data.eventId}`);
  });

  bookingQueue.on('completed', (job) => {
    console.log(`[bookingQueue] ✅ Job completed successfully - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`);
  });

  bookingQueue.on('failed', (job, err) => {
    console.error(`[bookingQueue] ❌ Job failed - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`, err.stack || err.message);
  });

  bookingQueue.on('stalled', (job) => {
    console.warn(`[bookingQueue] ⚠️ Job stalled - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`);
  });

  bookingQueue.on('progress', (job, progress) => {
    console.log(`[bookingQueue] 📊 Job ${job.id} is ${progress}% complete`);
  });

  // Register the job processor
  console.log('[bookingWorker] 📝 Registering job processor...');
  
  try {
    bookingQueue.process('bookingQueue', async (job) => {
      console.log("🔥 PROCESS FUNCTION CALLED! 🔥");
      console.log("Processing booking job...");
      
      const { userId, eventId } = job.data;
      console.log(`[bookingWorker] Processing job for user ${userId} and event ${eventId}`);
      console.log(`[bookingWorker] Job data:`, job.data);
      
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        console.log(`[bookingWorker] Starting transaction for user ${userId} and event ${eventId}`);
        
        const updatedEvent = await Event.findOneAndUpdate(
          {
            _id: eventId,
            $expr: { $gt: ["$totalSeats", "$registrationCount"] }
          },
          { $inc: { registrationCount: 1 } },
          { new: true, session }
        ).lean();

        if (!updatedEvent) {
          await session.abortTransaction();
          throw new Error("No tickets available - event is fully booked");
        }

        await Pass.create([{
          userId: new mongoose.Types.ObjectId(userId),
          eventId: new mongoose.Types.ObjectId(eventId),
          passStatus: "active",
          isScanned: false,
          timeScanned: null,
          createdAt: new Date(),
        }], { session });
   
        await session.commitTransaction();
        console.log(`[bookingWorker] ✅ Booking success for user ${userId} event ${eventId}`);
        
        return { success: true, userId, eventId };
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error(`[bookingWorker] ❌ Booking failed for user ${userId} event ${eventId}:`, error.stack || error.message);
        throw error;
      } finally {
        session.endSession();
      }
    });

    console.log('[bookingWorker] ✅ Job processor registered successfully');
  } catch (processorError) {
    console.error('[bookingWorker] ❌ Failed to register processor:', processorError);
    process.exit(1);
  }

  // Monitor queue status every 15 seconds (less frequent to reduce noise)
  const statusInterval = setInterval(async () => {
    try {
      const waiting = await bookingQueue.getWaiting();
      const active = await bookingQueue.getActive();
      const completed = await bookingQueue.getCompleted();
      const failed = await bookingQueue.getFailed();
      
      console.log(`[bookingWorker] 📊 Queue Status - Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}`);
      
      if (waiting.length > 0) {
        console.log('[bookingWorker] ⚠️ Jobs are waiting but not being processed!');
        console.log('[bookingWorker] First waiting job:', {
          id: waiting[0].id,
          data: waiting[0].data,
          timestamp: waiting[0].timestamp
        });
        
        // Try to manually trigger processing
        console.log('[bookingWorker] 🔧 Attempting to resume processing...');
        await bookingQueue.resume();
      }
      
      if (active.length === 0 && waiting.length === 0) {
        console.log('[bookingWorker] 😴 Queue is idle - no jobs to process');
      }
    } catch (error) {
      console.error('[bookingWorker] ❌ Error checking queue status:', error.message);
    }
  }, 15000);

  // Test job processing after 10 seconds
  setTimeout(async () => {
    try {
      console.log('[bookingWorker] 🧪 Running diagnostic check...');
      
      // Check if queue is paused
      const isPaused = await bookingQueue.isPaused();
      console.log(`[bookingWorker] Queue paused status: ${isPaused}`);
      
      if (isPaused) {
        console.log('[bookingWorker] 🔧 Resuming paused queue...');
        await bookingQueue.resume();
      }
      
      // Try to get queue health
      try {
        const health = await bookingQueue.checkHealth();
        console.log('[bookingWorker] Queue health:', health);
      } catch (healthError) {
        console.log('[bookingWorker] Queue health check not available:', healthError.message);
      }
      
    } catch (error) {
      console.error('[bookingWorker] ❌ Diagnostic check failed:', error.message);
    }
  }, 10000);

  console.log('[bookingWorker] 🎯 Worker is ready and waiting for jobs...');

  // Return cleanup function for testing
  return () => {
    clearInterval(statusInterval);
  };
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`[bookingWorker] 🛑 Received ${signal}, shutting down gracefully...`);
  try {
    await bookingQueue.close();
    console.log('[bookingWorker] ✅ Queue closed');
  } catch (error) {
    console.error('[bookingWorker] ❌ Error closing queue:', error.message);
  }
  
  try {
    await mongoose.disconnect();
    console.log('[bookingWorker] ✅ MongoDB disconnected');
  } catch (error) {
    console.error('[bookingWorker] ❌ Error disconnecting from MongoDB:', error.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[bookingWorker] ❌ Unhandled Promise Rejection:', reason);
  // Don't exit on unhandled rejections - just log them
});

startWorker().catch(err => {
  console.error('[bookingWorker] ❌ Failed to start:', err);
  process.exit(1);
});