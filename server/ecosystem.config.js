module.exports = {
  apps: [
    {
      name: 'server',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'booking-queue',
      script: 'src/queue/bookingWorker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    }
  ]
};