const express = require('express')
const cors = require('cors')
const reportQueue = require('./queue')
require('dotenv').config()
const JobLog = require('./models/JobLog')
require('./config/mongo')
const { createBullBoard } = require('@bull-board/api')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/jobs', async (req, res) => {
  const { reportName } = req.body

  if (!reportName) {
    return res.status(400).json({ error: 'reportName is required' })
  }

  const job = await reportQueue.add(
    'generate-report',
    { reportName },
    {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  )

  res.json({ jobId: job.id, status: 'queued' })
})

app.get('/api/jobs/history', async (req, res) => {
  const logs = await JobLog.find().sort({ processedAt: -1 }).limit(50)
  res.json(logs)
})

app.get('/api/queue/stats', async (req, res) => {
  const counts = await reportQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
  res.json(counts)
})

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [new BullMQAdapter(reportQueue)],
  serverAdapter,
})

app.use('/admin/queues', serverAdapter.getRouter())

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' }, // update to your real dashboard URL once deployed
})

app.set('io', io)

io.on('connection', (socket) => {
  socket.on('job-event', (data) => {
    io.emit('job-event', data)
  })
})

const workerModule = require('./worker')
workerModule.setIo(io)

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))