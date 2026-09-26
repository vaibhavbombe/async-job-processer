const { Worker } = require('bullmq')
const connection = require('./config/redis')
require('./config/mongo')
const { io: ioClient } = require('socket.io-client')
const socket = ioClient('http://localhost:4000')

const JobLog = require('./models/JobLog')
const worker = new Worker(
  'report-generation',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data)

    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Simulate a flaky external service (like a real third-party API
    // or database call) failing roughly 40% of the time.
    if (Math.random() < 0.4) {
      throw new Error('Simulated failure: report generation service timed out')
    }

    console.log(`Job ${job.id} completed`)
    return { message: `Report for ${job.data.reportName} generated successfully` }
  },
  { connection }
)
worker.on('completed', async (job) => {
  console.log(`✅ Job ${job.id} finished`)
  socket.emit('job-event', { jobId: job.id, status: 'completed', reportName: job.data.reportName })
  await JobLog.create({ /* ...existing code... */ })
})

worker.on('failed', async (job, err) => {
  console.log(`❌ Job ${job.id} failed:`, err.message)
  if (job.attemptsMade >= job.opts.attempts) {
    socket.emit('job-event', { jobId: job.id, status: 'failed', reportName: job.data.reportName })
    await JobLog.create({ /* ...existing code... */ })
  }
})

console.log('Worker is running and listening for jobs...')