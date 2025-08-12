const mongoose = require('mongoose');
const bookingQueue = require('./queue');
const Event = require('../models/events.model');
const Pass = require('../models/passes.model');
require('dotenv').config();

async function startWorker() {
  await mongoose.connect(process.env.DB_URL);
  console.log("------------------------------------------------------")
  console.log('[bookingWorker] Connected to MongoDB');

  bookingQueue.process(async (job) => {
    const { userId, eventId } = job.data;
    console.log(`[bookingWorker] Processing job for user ${userId} and event ${eventId}`);

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

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
      console.log(`[bookingWorker] Booking success for user ${userId} event ${eventId}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error(`[bookingWorker] Booking failed for user ${userId} event ${eventId}:`, error.stack || error.message);
      throw error;
    } finally {
      session.endSession();
    }
  });

  bookingQueue.on('completed', (job) => {
    console.log(`[bookingQueue] Job completed successfully - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`);
  });

  bookingQueue.on('failed', (job, err) => {
    console.error(`[bookingQueue] Job failed - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`, err.stack || err.message);
  });

  bookingQueue.on('stalled', (job) => {
    console.warn(`[bookingQueue] Job stalled - id: ${job.id}, userId: ${job.data.userId}, eventId: ${job.data.eventId}`);
 });
}
startWorker().catch(err => {
  console.error('[bookingWorker] Failed to start:', err);
  process.exit(1);
});

