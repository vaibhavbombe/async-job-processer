const mongoose = require('mongoose')

const jobLogSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  reportName: { type: String, required: true },
  status: { type: String, enum: ['completed', 'failed'], required: true },
  attempts: { type: Number, required: true },
  error: { type: String, default: null },
  processedAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('JobLog', jobLogSchema)