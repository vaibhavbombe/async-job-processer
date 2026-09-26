const { Worker } = require('bullmq')
const connection = require('./config/redis')
require('./config/mongo')
const JobLog = require('./models/JobLog')
const { io: ioClient } = require('socket.io-client')

const socket = ioClient('http://localhost:4000')

const worker = new Worker(
  'report-generation',
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data)

    await new Promise((resolve) => setTimeout(resolve, 3000))

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

  socket.emit('job-event', {
    jobId: job.id,
    status: 'completed',
    reportName: job.data.reportName,
  })

  await JobLog.create({
    jobId: job.id,
    reportName: job.data.reportName,
    status: 'completed',
    attempts: job.attemptsMade,
  })
})

worker.on('failed', async (job, err) => {
  console.log(`❌ Job ${job.id} failed:`, err.message)

  if (job.attemptsMade >= job.opts.attempts) {
    socket.emit('job-event', {
      jobId: job.id,
      status: 'failed',
      reportName: job.data.reportName,
    })

    await JobLog.create({
      jobId: job.id,
      reportName: job.data.reportName,
      status: 'failed',
      attempts: job.attemptsMade,
      error: err.message,
    })
  }
})

console.log('Worker is running and listening for jobs...')