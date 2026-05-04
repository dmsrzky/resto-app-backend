// src/index.ts
// UPDATED: tambah startDailyReportCron() untuk laporan harian otomatis

import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import routes from './routes'
import { startDailyReportCron } from './services/laporan.service'
import 'module-alias/register'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
    next()
  })
}

app.use('/api', routes)

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route tidak ditemukan' })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Terjadi kesalahan pada server' : err.message,
  })
})

app.listen(PORT, () => {
  console.log(`
🚀 Server berjalan di http://localhost:${PORT}
📊 Environment: ${process.env.NODE_ENV || 'development'}
🔗 Health check: http://localhost:${PORT}/health
🗄️  Prisma Studio: npm run db:studio
  `)

  // Aktifkan cron laporan harian otomatis
  startDailyReportCron()
})

export default app
