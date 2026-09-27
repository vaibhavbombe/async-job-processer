import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { FiSend, FiClock, FiPlay, FiCheckCircle, FiXCircle, FiPause, FiActivity } from 'react-icons/fi'
import './App.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const API_URL = 'http://localhost:4000'

const STAT_META = {
  waiting: { label: 'Waiting', icon: FiClock, color: '#F7B84B' },
  active: { label: 'Active', icon: FiPlay, color: '#7C6FF0' },
  completed: { label: 'Completed', icon: FiCheckCircle, color: '#4AD3C9' },
  failed: { label: 'Failed', icon: FiXCircle, color: '#FF6B45' },
  delayed: { label: 'Delayed', icon: FiPause, color: '#A6A6AC' },
}

export default function App() {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [chartData, setChartData] = useState({ labels: [], completed: [], failed: [] })
  const [reportName, setReportName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const socketRef = useRef(null)

  const fetchStats = async () => {
    const res = await axios.get(`${API_URL}/api/queue/stats`)
    setStats(res.data)
  }

  const fetchHistory = async () => {
    const res = await axios.get(`${API_URL}/api/jobs/history`)
    setHistory(res.data)
  }

  useEffect(() => {
    const init = async () => {
      await fetchStats()
      const res = await axios.get(`${API_URL}/api/jobs/history`)
      const logs = res.data
      setHistory(logs)

      // Seed the live chart with real historical data, not just future events.
      const chronological = [...logs].reverse()
      let completedCount = 0
      let failedCount = 0
      const labels = [], completed = [], failed = []

      chronological.forEach((log) => {
        if (log.status === 'completed') completedCount++
        if (log.status === 'failed') failedCount++
        labels.push(new Date(log.processedAt).toLocaleTimeString())
        completed.push(completedCount)
        failed.push(failedCount)
      })

      setChartData({
        labels: labels.slice(-20),
        completed: completed.slice(-20),
        failed: failed.slice(-20),
      })
    }

    init()
    const statsInterval = setInterval(fetchStats, 2000)
    socketRef.current = io(API_URL)

    socketRef.current.on('job-event', (event) => {
      fetchStats()
      fetchHistory()

      setChartData((prev) => {
        const time = new Date().toLocaleTimeString()
        const completed = [...prev.completed]
        const failed = [...prev.failed]
        completed.push(event.status === 'completed' ? (completed.at(-1) || 0) + 1 : (completed.at(-1) || 0))
        failed.push(event.status === 'failed' ? (failed.at(-1) || 0) + 1 : (failed.at(-1) || 0))
        return {
          labels: [...prev.labels, time].slice(-20),
          completed: completed.slice(-20),
          failed: failed.slice(-20),
        }
      })
    })

    return () => {
      socketRef.current.disconnect()
      clearInterval(statsInterval)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reportName.trim()) return
    setSubmitting(true)
    setLastResult(null)
    try {
      const res = await axios.post(`${API_URL}/api/jobs`, { reportName })
      setLastResult({ ok: true, text: `Job #${res.data.jobId} queued.` })
      setReportName('')
      fetchStats()
    } catch {
      setLastResult({ ok: false, text: 'Could not submit job.' })
    } finally {
      setSubmitting(false)
    }
  }

  const chart = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Completed',
        data: chartData.completed,
        borderColor: '#4AD3C9',
        backgroundColor: 'rgba(74, 211, 201, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: 'Failed',
        data: chartData.failed,
        borderColor: '#FF6B45',
        backgroundColor: 'rgba(255, 107, 69, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  }

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="nav-title">
          <FiActivity size={18} />
          <span>Async Job Processor</span>
        </div>
        <span className="nav-tag">BullMQ + Redis + MongoDB</span>
      </nav>

      <main className="dashboard-grid">
        {/* Left column - submit form + stats */}
        <section className="col col-left">
          <form className="submit-form" onSubmit={handleSubmit}>
            <label>Submit a job</label>
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g. Q3 Sales Report"
              disabled={submitting}
            />
            <button type="submit" disabled={submitting}>
              <FiSend size={14} /> {submitting ? 'Submitting...' : 'Submit'}
            </button>
            {lastResult && (
              <p className={`submit-result ${lastResult.ok ? 'ok' : 'error'}`}>{lastResult.text}</p>
            )}
          </form>

          <div className="stats-stack">
            {stats && Object.entries(stats).map(([key, value]) => {
              const meta = STAT_META[key] || { label: key, icon: FiClock, color: '#A6A6AC' }
              const Icon = meta.icon
              return (
                <div key={key} className="stat-card" style={{ '--accent': meta.color }}>
                  <Icon size={18} className="stat-icon" />
                  <div>
                    <p className="stat-value">{value}</p>
                    <p className="stat-label">{meta.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Middle column - chart */}
        <section className="col col-middle">
          <div className="panel">
            <h2>Throughput (live)</h2>
            <Line
              data={chart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#F5F5F3', font: { family: 'monospace', size: 11 } } } },
                scales: {
                  x: { ticks: { color: '#6B6B70', font: { size: 9 } }, grid: { color: '#1E1E22' } },
                  y: { ticks: { color: '#6B6B70' }, grid: { color: '#1E1E22' }, beginAtZero: true },
                },
              }}
            />
          </div>
        </section>

        {/* Right column - job log table */}
        <section className="col col-right">
          <div className="panel">
            <h2>Recent Jobs</h2>
            <div className="table-scroll">
              <table className="job-table">
                <thead>
                  <tr><th>Report</th><th>Status</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={3} className="empty-row">No jobs yet</td></tr>
                  )}
                  {history.map((job) => (
                    <tr key={job._id}>
                      <td className="ellipsis">{job.reportName}</td>
                      <td><span className={`badge ${job.status}`}>{job.status}</span></td>
                      <td className="time-col">{new Date(job.processedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>&copy; {new Date().getFullYear()} Vaibhav Bombe</span>
        <span>Async Job Processor — a BullMQ + Redis + MongoDB systems project</span>
      </footer>
    </div>
  )
}