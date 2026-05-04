// src/services/email.service.ts
// Kirim email notifikasi menggunakan Nodemailer.
// Dua jenis email:
// 1. Ke customer: konfirmasi order diterima
// 2. Ke admin: notifikasi ada order baru

import nodemailer from 'nodemailer'
import { Order, OrderItem, MenuItem } from '@prisma/client'
import { formatRupiah } from '@/utils/response'

// Tipe Order lengkap dengan items dan menu item
type OrderWithItems = Order & {
  items: (OrderItem & { menuItem: MenuItem })[]
}

// Buat transporter Nodemailer (dibuat sekali, dipakai berulang)
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

// ─── Template email customer ────────────────────────────────
function customerOrderTemplate(order: OrderWithItems): string {
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0">${item.menuItem.name}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right">${formatRupiah(item.price * item.quantity)}</td>
      </tr>
    `
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
      <div style="background:#f97316;padding:20px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:white;margin:0;font-size:24px">Warung Barokah 🍜</h1>
        <p style="color:#fff3e0;margin:8px 0 0">Pesanan Diterima!</p>
      </div>
      
      <div style="background:white;padding:24px;border:1px solid #f0f0f0">
        <p>Halo <strong>${order.customerName}</strong>,</p>
        <p>Pesananmu sudah kami terima! Berikut ringkasan pesananmu:</p>
        
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin:16px 0">
          <strong>Nomor Order: #${order.id}</strong><br>
          <span style="color:#9a3412">
            ${order.orderType === 'PICKUP' ? '🥡 Pickup — Ambil di kasir' : `🪑 Dine-in — Meja ${order.tableNumber}`}
          </span>
        </div>

        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px;text-align:left;font-size:12px;color:#6b7280">ITEM</th>
              <th style="padding:8px;text-align:center;font-size:12px;color:#6b7280">QTY</th>
              <th style="padding:8px;text-align:right;font-size:12px;color:#6b7280">HARGA</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="border-top:2px solid #f97316;margin-top:16px;padding-top:16px">
          <table style="width:100%">
            <tr>
              <td style="color:#6b7280;padding:4px 0">Subtotal</td>
              <td style="text-align:right;padding:4px 0">${formatRupiah(order.subtotal)}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:4px 0">Biaya Layanan</td>
              <td style="text-align:right;padding:4px 0">${formatRupiah(order.serviceFee)}</td>
            </tr>
            <tr>
              <td style="color:#6b7280;padding:4px 0">PPN 11%</td>
              <td style="text-align:right;padding:4px 0">${formatRupiah(order.tax)}</td>
            </tr>
            <tr>
              <td style="font-weight:bold;padding:8px 0 4px;font-size:16px">Total</td>
              <td style="text-align:right;font-weight:bold;color:#f97316;font-size:16px;padding:8px 0 4px">${formatRupiah(order.totalPrice)}</td>
            </tr>
          </table>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-top:16px">
          <p style="margin:0;color:#166534;font-size:14px">
            ${order.paymentMethod === 'CASH'
              ? '💵 Pembayaran: Bayar tunai saat mengambil pesanan di kasir.'
              : '💳 Pembayaran: Silakan selesaikan pembayaran melalui link yang kami kirimkan.'}
          </p>
        </div>

        <p style="margin-top:20px;color:#6b7280;font-size:14px">
          Ada pertanyaan? Hubungi kami via WhatsApp di nomor yang tertera di resto.
        </p>
      </div>

      <div style="background:#f9fafb;padding:12px;text-align:center;border-radius:0 0 12px 12px">
        <p style="margin:0;font-size:12px;color:#9ca3af">© Warung Barokah — Terima kasih sudah memesan! 🙏</p>
      </div>
    </body>
    </html>
  `
}

// ─── Template email admin ───────────────────────────────────
function adminOrderTemplate(order: OrderWithItems): string {
  const itemsList = order.items
    .map((i) => `• ${i.menuItem.name} ×${i.quantity} — ${formatRupiah(i.price * i.quantity)}`)
    .join('\n')

  return `
    <div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
      <h2 style="color:#f97316">🔔 Order Baru Masuk!</h2>
      <p><strong>Order ID:</strong> #${order.id}</p>
      <p><strong>Customer:</strong> ${order.customerName} (${order.customerPhone})</p>
      <p><strong>Tipe:</strong> ${order.orderType === 'PICKUP' ? 'Pickup' : `Dine-in Meja ${order.tableNumber}`}</p>
      <p><strong>Pembayaran:</strong> ${order.paymentMethod === 'CASH' ? 'Cash' : 'Midtrans'}</p>
      <p><strong>Total:</strong> ${formatRupiah(order.totalPrice)}</p>
      <hr>
      <p><strong>Item:</strong></p>
      <pre style="background:#f9fafb;padding:12px;border-radius:8px">${itemsList}</pre>
      ${order.notes ? `<p><strong>Catatan:</strong> ${order.notes}</p>` : ''}
    </div>
  `
}

// ─── Email Service ──────────────────────────────────────────
export const emailService = {

  // Kirim konfirmasi ke customer
  async sendOrderConfirmation(order: OrderWithItems) {
    try {
      const transporter = createTransporter()
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: order.customerEmail,
        subject: `✅ Pesanan #${order.id} Diterima — Warung Barokah`,
        html: customerOrderTemplate(order),
      })
      console.log(`📧 Email konfirmasi terkirim ke ${order.customerEmail}`)
    } catch (error) {
      // Jangan crash app kalau email gagal — log saja
      console.error('❌ Gagal kirim email customer:', error)
    }
  },

  // Kirim notifikasi ke admin
  async sendAdminNotification(order: OrderWithItems) {
    try {
      const transporter = createTransporter()
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.ADMIN_EMAIL,
        subject: `🔔 Order Baru #${order.id} — ${order.customerName}`,
        html: adminOrderTemplate(order),
      })
      console.log(`📧 Notifikasi admin terkirim`)
    } catch (error) {
      console.error('❌ Gagal kirim email admin:', error)
    }
  },
}
