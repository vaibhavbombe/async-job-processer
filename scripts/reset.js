const reportQueue = require('../queue')
const JobLog = require('../models/JobLog')
require('../config/mongo')

async function reset() {
  await reportQueue.obliterate({ force: true })
  console.log('BullMQ queue data cleared from Redis')

  await JobLog.deleteMany({})
  console.log('MongoDB job history cleared')

  process.exit(0)
}

reset()