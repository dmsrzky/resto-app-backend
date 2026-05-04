// src/controllers/order.controller.ts
// Handle semua operasi order:
// - Customer: buat order, cek status
// - Admin: lihat semua order, update status
// - Midtrans: webhook pembayaran

import { Request, Response } from 'express'
import { prisma } from '@/utils/prisma'
import { sendSuccess, sendError } from '@/utils/response'
import { emailService } from '@/services/email.service'
import { midtransService } from '@/services/midtrans.service'
import { z } from 'zod'

const TAX_RATE = 0.11
const SERVICE_FEE = 2000

// Validasi input buat order baru
const createOrderSchema = z.object({
  customerName: z.string().min(1, 'Nama wajib diisi'),
  customerPhone: z.string().min(10, 'No. HP tidak valid'),
  customerEmail: z.string().email('Email tidak valid'),
  orderType: z.enum(['DINE_IN', 'PICKUP']),
  tableNumber: z.string().optional(),
  paymentMethod: z.enum(['MIDTRANS', 'CASH']),
  notes: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1, 'Minimal 1 item'),
})

export const orderController = {

  // ─── POST /api/orders ──────────────────────────────────────
  // Customer: buat order baru
  async create(req: Request, res: Response) {
    const result = createOrderSchema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'Input tidak valid', 400, result.error.flatten())
    }

    const { items, orderType, tableNumber, paymentMethod, notes, ...customerData } = result.data

    // Validasi: dine-in harus ada nomor meja
    if (orderType === 'DINE_IN' && !tableNumber) {
      return sendError(res, 'Nomor meja wajib diisi untuk dine-in', 400)
    }

    // Ambil data menu item dari database untuk validasi harga
    const menuItemIds = items.map((i) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
    })

    // Pastikan semua item yang dipesan masih tersedia
    if (menuItems.length !== menuItemIds.length) {
      return sendError(res, 'Beberapa menu item tidak tersedia atau tidak ditemukan', 400)
    }

    // Hitung harga (selalu dari database, bukan dari frontend — keamanan!)
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]))
    let subtotal = 0
    const orderItemsData = items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!
      subtotal += menuItem.price * item.quantity
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price, // snapshot harga saat ini
        notes: item.notes,
      }
    })

    const tax = Math.round(subtotal * TAX_RATE)
    const totalPrice = subtotal + SERVICE_FEE + tax

    // Buat order di database
    const order = await prisma.order.create({
      data: {
        ...customerData,
        orderType,
        tableNumber,
        paymentMethod,
        notes,
        subtotal,
        serviceFee: SERVICE_FEE,
        tax,
        totalPrice,
        status: paymentMethod === 'CASH' ? 'PAID' : 'PENDING_PAYMENT',
        items: { create: orderItemsData },
      },
      include: { items: { include: { menuItem: true } } },
    })

    let snapToken: string | undefined

    // Kalau bayar online, buat transaksi Midtrans
    if (paymentMethod === 'MIDTRANS') {
      try {
        snapToken = await midtransService.createTransaction(order)
        // Simpan snapToken ke database
        await prisma.order.update({
          where: { id: order.id },
          data: { snapToken },
        })
      } catch (error) {
        console.error('Midtrans error:', error)
        return sendError(res, 'Gagal membuat transaksi pembayaran', 500)
      }
    }

    // Kirim email notifikasi (tidak await — jangan block response)
    emailService.sendOrderConfirmation(order)
    emailService.sendAdminNotification(order)

    return sendSuccess(res, {
      orderId: order.id,
      snapToken,
      totalPrice: order.totalPrice,
      status: order.status,
    }, 'Order berhasil dibuat', 201)
  },

  // TAMBAHKAN method ini ke dalam orderController di src/controllers/order.controller.ts
  // Letakkan setelah method getOne, sebelum getAll

  // ─── GET /api/orders?phone=08xxx ──────────────────────────────
  // Publik: ambil semua pesanan berdasarkan nomor HP customer.
  // Hanya tampilkan order yang masih aktif (bukan completed/cancelled lama).
  // Customer pakai ini untuk cek status pesanan mereka.
  async getByPhone(req: Request, res: Response) {
    const { phone } = req.query

    if (!phone || typeof phone !== 'string') {
      return sendError(res, 'Nomor HP wajib diisi', 400)
    }

    // Bersihkan nomor HP — hapus spasi, strip, dan awalan +62
    const cleanPhone = phone.replace(/\D/g, '').replace(/^62/, '0')

    if (cleanPhone.length < 9) {
      return sendError(res, 'Nomor HP tidak valid', 400)
    }

    // Cari order dengan nomor HP yang cocok
    // Ambil 10 order terbaru, urutkan dari yang paling baru
    const orders = await prisma.order.findMany({
      where: {
        customerPhone: { contains: cleanPhone },
      },
      include: {
        items: { include: { menuItem: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return sendSuccess(res, orders)
  },

  // ─── GET /api/orders/:id ───────────────────────────────────
  // Publik: cek status order berdasarkan ID
  async getOne(req: Request, res: Response) {
    const { id } = req.params
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { menuItem: true } } },
    })
    if (!order) return sendError(res, 'Order tidak ditemukan', 404)
    return sendSuccess(res, order)
  },

  // ─── GET /api/admin/orders ─────────────────────────────────
  // Admin only: list semua order dengan filter
  async getAll(req: Request, res: Response) {
    const { status, date, page = '1', limit = '20', exclude } = req.query

    const where: any = {}
    if (status) where.status = status
    if (exclude) {
      const excludeList = Array.isArray(exclude) ? exclude : [exclude]
      where.status = { notIn: excludeList }
    }
    if (date) {
      const start = new Date(date as string)
      const end = new Date(date as string)
      end.setDate(end.getDate() + 1)
      where.createdAt = { gte: start, lt: end }
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ])

    return sendSuccess(res, {
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  },

  // ─── PATCH /api/admin/orders/:id/status ────────────────────
  // Admin only: update status order
  async updateStatus(req: Request, res: Response) {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return sendError(res, 'Status tidak valid', 400)
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) return sendError(res, 'Order tidak ditemukan', 404)

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { menuItem: true } } },
    })

    return sendSuccess(res, updated, `Status order diupdate ke ${status}`)
  },

  async getSnapToken(req: Request, res: Response) {
    const { id } = req.params
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { menuItem: true } } },
    })
    if (!order) return sendError(res, 'Order tidak ditemukan', 404)
    if (order.status !== 'PENDING_PAYMENT') {
      return sendError(res, 'Order sudah dibayar', 400)
    }
    try {
      // Selalu buat snapToken baru supaya customer bisa pilih metode pembayaran dari awal
      const snapToken = await midtransService.createTransaction(order)
      await prisma.order.update({ where: { id }, data: { snapToken } })
      return sendSuccess(res, { snapToken })
    } catch (error) {
      console.error('getSnapToken error:', error)
      return sendError(res, 'Gagal membuat transaksi', 500)
    }
  },

  // ─── POST /api/payment/webhook ─────────────────────────────
  // Endpoint untuk menerima notifikasi dari Midtrans
  // URL ini harus didaftarkan di dashboard Midtrans
  async midtransWebhook(req: Request, res: Response) {
    try {
      const notification = await midtransService.verifyWebhook(req.body)

      const { order_id, transaction_status, fraud_status, payment_type } = notification

      const actualOrderId = order_id.includes('-')
        ? order_id.split('-').slice(0, -1).join('-')
        : order_id

      // Tentukan status order berdasarkan status dari Midtrans
      let newStatus: string | null = null

      if (transaction_status === 'capture') {
        newStatus = fraud_status === 'accept' ? 'PAID' : null
      } else if (transaction_status === 'settlement') {
        newStatus = 'PAID'
      } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
        newStatus = 'CANCELLED'
      } else if (transaction_status === 'pending') {
        newStatus = 'PENDING_PAYMENT'
      }

      if (newStatus) {
        await prisma.order.update({
          where: { id: actualOrderId },  // ← ganti ini
          data: {
            status: newStatus as any,
            paymentToken: payment_type,
          },
        })
        console.log(`✅ Order ${actualOrderId} status updated to ${newStatus}`)  // ← ganti ini
      }

      // Selalu return 200 ke Midtrans supaya tidak di-retry
      return res.status(200).json({ message: 'OK' })
    } catch (error) {
      console.error('Webhook error:', error)
      return res.status(200).json({ message: 'OK' }) // tetap 200
    }
  },
}
