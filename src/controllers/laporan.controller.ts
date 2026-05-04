// src/controllers/laporan.controller.ts
// Handle semua data untuk halaman laporan admin:
// - GET /api/admin/laporan/summary   → ringkasan hari ini + 7 hari
// - GET /api/admin/laporan/export    → download file Excel
// - GET /api/admin/laporan/terlaris  → menu terlaris

import { Request, Response } from 'express'
import { prisma } from '@/utils/prisma'
import { sendSuccess, sendError, formatRupiah } from '@/utils/response'
import ExcelJS from 'exceljs'

// Helper: awal dan akhir hari
function getDayRange(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

// Helper: 7 hari terakhir
function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    days.push(date)
  }
  return days
}

export const laporanController = {

  // ─── GET /api/admin/laporan/summary ───────────────────────
  // Ringkasan statistik: hari ini + 7 hari terakhir + menu terlaris
  async getSummary(req: Request, res: Response) {
    const today = new Date()
    const { start: todayStart, end: todayEnd } = getDayRange(today)

    // Awal bulan ini
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // ── Data hari ini ──
    const [todayOrders, monthOrders] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: { items: { include: { menuItem: true } } },
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: monthStart },
          status: { not: 'CANCELLED' },
        },
      }),
    ])

    // Hanya COMPLETED yang masuk hitungan pendapatan
    const todayRevenue = todayOrders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + o.totalPrice, 0)

    const todayCompleted = todayOrders.filter((o) => o.status === 'COMPLETED').length
    const todayPending = todayOrders.filter((o) => ['PAID', 'PREPARING', 'READY'].includes(o.status)).length
    const todayCancelled = todayOrders.filter((o) => o.status === 'CANCELLED').length

    const monthRevenue = monthOrders
      .filter((o) => o.status === 'COMPLETED')
      .reduce((sum, o) => sum + o.totalPrice, 0)

    // ── Grafik 7 hari terakhir ──
    const last7Days = getLast7Days()
    const chartData = await Promise.all(
      last7Days.map(async (date) => {
        const { start, end } = getDayRange(date)
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            status: 'COMPLETED',
          },
        })
        const revenue = orders.reduce((sum, o) => sum + o.totalPrice, 0)
        return {
          date: date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
          revenue,
          orderCount: orders.length,
        }
      })
    )

    // ── Menu terlaris ──
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: 'COMPLETED',
          createdAt: { gte: monthStart },
        },
      },
      include: { menuItem: true },
    })

    const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
    orderItems.forEach((item) => {
      const existing = menuMap.get(item.menuItemId)
      if (existing) {
        existing.qty += item.quantity
        existing.revenue += item.price * item.quantity
      } else {
        menuMap.set(item.menuItemId, {
          name: item.menuItem.name,
          qty: item.quantity,
          revenue: item.price * item.quantity,
        })
      }
    })

    const terlaris = Array.from(menuMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    // ── Metode pembayaran ──
    const paymentStats = {
      midtrans: todayOrders.filter((o) => o.paymentMethod === 'MIDTRANS').length,
      cash: todayOrders.filter((o) => o.paymentMethod === 'CASH').length,
    }

    return sendSuccess(res, {
      today: {
        revenue: todayRevenue,
        orderCount: todayOrders.length,
        completed: todayCompleted,
        pending: todayPending,
        cancelled: todayCancelled,
      },
      month: {
        revenue: monthRevenue,
        orderCount: monthOrders.length,
      },
      chartData,
      terlaris,
      paymentStats,
    })
  },

  // ─── GET /api/admin/laporan/export ────────────────────────
  // Export data order ke file Excel
  async exportExcel(req: Request, res: Response) {
    const { from, to } = req.query

    const startDate = from ? new Date(from as string) : new Date()
    const endDate = to ? new Date(to as string) : new Date()

    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'asc' },
    })

    // Buat workbook Excel
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Warung Barokah'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Laporan Transaksi')

    // Header style
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    // Judul laporan
    sheet.mergeCells('A1:I1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = `LAPORAN TRANSAKSI WARUNG BAROKAH`
    titleCell.style = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: 'center' },
    }

    sheet.mergeCells('A2:I2')
    const dateCell = sheet.getCell('A2')
    dateCell.value = `Periode: ${startDate.toLocaleDateString('id-ID', { dateStyle: 'long' })} - ${endDate.toLocaleDateString('id-ID', { dateStyle: 'long' })}`
    dateCell.style = { alignment: { horizontal: 'center' } }

    sheet.addRow([]) // baris kosong

    // Header kolom
    const headerRow = sheet.addRow([
      'No', 'Tanggal', 'Waktu', 'Nama Customer', 'No. HP',
      'Tipe', 'Item Pesanan', 'Pembayaran', 'Total (Rp)'
    ])
    headerRow.eachCell((cell) => { cell.style = headerStyle })
    headerRow.height = 25

    // Lebar kolom
    sheet.columns = [
      { key: 'no', width: 5 },
      { key: 'tanggal', width: 15 },
      { key: 'waktu', width: 10 },
      { key: 'nama', width: 20 },
      { key: 'hp', width: 15 },
      { key: 'tipe', width: 12 },
      { key: 'item', width: 35 },
      { key: 'bayar', width: 15 },
      { key: 'total', width: 18 },
    ]

    // Data rows
    let totalRevenue = 0
    orders.forEach((order, index) => {
      const itemStr = order.items
        .map((i) => `${i.menuItem.name} x${i.quantity}`)
        .join(', ')

      const row = sheet.addRow([
        index + 1,
        new Date(order.createdAt).toLocaleDateString('id-ID'),
        new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        order.customerName,
        order.customerPhone,
        order.orderType === 'PICKUP' ? 'Pickup' : `Dine-in (Meja ${order.tableNumber})`,
        itemStr,
        order.paymentMethod === 'MIDTRANS' ? 'Online (Midtrans)' : 'Cash',
        order.totalPrice,
      ])

      // Style baris data
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        }
      })

      // Warna selang-seling
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }
        })
      }

      // Format kolom total sebagai angka
      const totalCell = row.getCell(9)
      totalCell.numFmt = '#,##0'
      totalCell.alignment = { horizontal: 'right' }

      totalRevenue += order.totalPrice
    })

    // Baris total
    sheet.addRow([])
    const totalRow = sheet.addRow([
      '', '', '', '', '', '', '', 'TOTAL PENDAPATAN',
      totalRevenue,
    ])
    totalRow.getCell(8).style = {
      font: { bold: true },
      alignment: { horizontal: 'right' },
    }
    totalRow.getCell(9).style = {
      font: { bold: true, color: { argb: 'FFEA580C' } },
      numFmt: '#,##0',
      alignment: { horizontal: 'right' },
    }

    // Kirim file ke client
    const filename = `laporan-warung-barokah-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await workbook.xlsx.write(res)
    res.end()
  },
}
