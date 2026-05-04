// src/services/laporan.service.ts
// Laporan harian otomatis via email menggunakan node-cron.
// Jadwal: setiap hari jam 23:00 WIB (16:00 UTC)
// Isi email: ringkasan pendapatan + file Excel terlampir

import cron from 'node-cron'
import nodemailer from 'nodemailer'
import ExcelJS from 'exceljs'
import { prisma } from '@/utils/prisma'
import { formatRupiah } from '@/utils/response'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

// Generate file Excel untuk laporan harian
async function generateDailyExcel(date: Date): Promise<Buffer> {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    include: { items: { include: { menuItem: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Laporan Harian')

  // Header
  sheet.addRow(['No', 'Waktu', 'Customer', 'Item', 'Tipe', 'Bayar', 'Total'])
  sheet.getRow(1).font = { bold: true }

  let total = 0
  orders.forEach((order, i) => {
    const items = order.items.map((it) => `${it.menuItem.name} x${it.quantity}`).join(', ')
    sheet.addRow([
      i + 1,
      new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      order.customerName,
      items,
      order.orderType === 'PICKUP' ? 'Pickup' : `Dine-in`,
      order.paymentMethod === 'MIDTRANS' ? 'Online' : 'Cash',
      order.totalPrice,
    ])
    total += order.totalPrice
  })

  sheet.addRow([])
  sheet.addRow(['', '', '', '', '', 'TOTAL', total])

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// Kirim laporan harian via email
async function sendDailyReport() {
  const today = new Date()
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)

  // Ambil data hari ini
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    include: { items: { include: { menuItem: true } } },
  })

  const paidOrders = orders.filter((o) =>
    ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(o.status)
  )
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalPrice, 0)
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length

  // Menu terlaris hari ini
  const itemMap = new Map<string, { name: string; qty: number }>()
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const ex = itemMap.get(item.menuItemId)
      if (ex) {
        ex.qty += item.quantity
      } else {
        itemMap.set(item.menuItemId, { name: item.menuItem.name, qty: item.quantity })
      }
    })
  })
  const terlaris = Array.from(itemMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3)

  const dateStr = today.toLocaleDateString('id-ID', { dateStyle: 'full' })

  // Template email HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#f97316;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0">🍜 Warung Barokah</h1>
        <p style="color:#fff3e0;margin:8px 0 0">Laporan Harian — ${dateStr}</p>
      </div>

      <div style="background:white;padding:24px;border:1px solid #f0f0f0">
        <h2 style="color:#374151;margin-top:0">Ringkasan Hari Ini</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:bold;color:#f97316">${formatRupiah(totalRevenue)}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#9a3412">Total Pendapatan</p>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:bold;color:#2563eb">${orders.length}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#1e40af">Total Order</p>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:bold;color:#16a34a">${completedCount}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#166534">Order Selesai</p>
          </div>
        </div>

        ${terlaris.length > 0 ? `
        <h3 style="color:#374151">🏆 Menu Terlaris Hari Ini</h3>
        <ol style="padding-left:20px">
          ${terlaris.map((item) => `<li style="margin-bottom:4px">${item.name} — ${item.qty} porsi</li>`).join('')}
        </ol>
        ` : ''}

        <p style="color:#6b7280;font-size:14px;margin-top:20px">
          File Excel terlampir berisi detail semua transaksi hari ini.
        </p>
      </div>

      <div style="background:#f9fafb;padding:12px;text-align:center;border-radius:0 0 12px 12px">
        <p style="margin:0;font-size:12px;color:#9ca3af">
          Email ini dikirim otomatis setiap malam oleh sistem Warung Barokah
        </p>
      </div>
    </body>
    </html>
  `

  // Generate Excel attachment
  const excelBuffer = await generateDailyExcel(today)
  const filename = `laporan-${today.toISOString().split('T')[0]}.xlsx`

  // Kirim email
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: `📊 Laporan Harian ${dateStr} — Warung Barokah`,
    html,
    attachments: [
      {
        filename,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
  })

  console.log(`📧 Laporan harian terkirim ke ${process.env.ADMIN_EMAIL}`)
}

// Jadwalkan pengiriman laporan setiap hari jam 23:00 WIB (16:00 UTC)
export function startDailyReportCron() {
  // Format cron: detik menit jam hari bulan hari-minggu
  // '0 16 * * *' = jam 16:00 UTC = 23:00 WIB
  cron.schedule('0 16 * * *', async () => {
    console.log('⏰ Menjalankan laporan harian otomatis...')
    try {
      await sendDailyReport()
    } catch (error) {
      console.error('❌ Gagal kirim laporan harian:', error)
    }
  }, {
    timezone: 'UTC'
  })

  // Cron auto-expire order pending setiap jam
  cron.schedule('0 * * * *', async () => {
    const expiredTime = new Date()
    expiredTime.setHours(expiredTime.getHours() - 24)

    try {
      const expired = await prisma.order.updateMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: { lt: expiredTime },
        },
        data: { status: 'CANCELLED' },
      })

      if (expired.count > 0) {
        console.log(`⏰ ${expired.count} order pending expired otomatis`)
      }
    } catch (error) {
      console.error('❌ Gagal auto-expire order:', error)
    }
  })

  console.log('✅ Cron laporan harian aktif — kirim setiap jam 23:00 WIB')
}