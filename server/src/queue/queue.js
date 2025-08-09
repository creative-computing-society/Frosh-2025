const Queue = require('bull');

const bookingQueue = new Queue('bookingQueue', {
  redis: { host: '127.0.0.1', port: 6379 }
});

module.exports = bookingQueue;
