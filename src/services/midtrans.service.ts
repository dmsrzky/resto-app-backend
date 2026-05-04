// src/services/midtrans.service.ts
// Integrasi Midtrans Snap untuk pembayaran online.
//
// Flow:
// 1. Customer checkout → kita buat transaksi di Midtrans → dapat snapToken
// 2. Frontend jalankan snap.pay(snapToken) → popup pembayaran muncul
// 3. Customer bayar → Midtrans kirim webhook ke /api/payment/webhook
// 4. Kita update status order berdasarkan notifikasi webhook

import MidtransClient from 'midtrans-client'
import { Order, OrderItem, MenuItem } from '@prisma/client'

type OrderWithItems = Order & {
  items: (OrderItem & { menuItem: MenuItem })[]
}

// Inisialisasi Snap client
// isProduction: false = sandbox mode (untuk testing)
function getSnapClient() {
  return new MidtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY!,
  })
}

// Inisialisasi Core API client (untuk verify webhook)
function getCoreClient() {
  return new MidtransClient.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY!,
  })
}

export const midtransService = {

  // Buat transaksi Snap dan dapatkan token
  async createTransaction(order: OrderWithItems): Promise<string> {
    const snap = getSnapClient()

    const parameter = {
      transaction_details: {
        // Tambah timestamp supaya order_id selalu unik di Midtrans
        order_id: `${order.id}-${Date.now()}`,
        gross_amount: order.totalPrice,
      },
      customer_details: {
        first_name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      item_details: [
        // Tambahkan semua item ke detail transaksi
        ...order.items.map((item) => ({
          id: item.menuItemId,
          price: item.price,
          quantity: item.quantity,
          name: item.menuItem.name.substring(0, 50), // max 50 char
        })),
        // Tambahkan biaya layanan dan pajak sebagai item terpisah
        {
          id: 'SERVICE_FEE',
          price: order.serviceFee,
          quantity: 1,
          name: 'Biaya Layanan',
        },
        {
          id: 'TAX',
          price: order.tax,
          quantity: 1,
          name: 'PPN 11%',
        },
      ],
      callbacks: {
        // URL redirect setelah bayar (opsional, karena kita pakai popup)
        finish: `${process.env.FRONTEND_URL}/order/${order.id}`,
      },
    }

    const transaction = await snap.createTransaction(parameter)
    return transaction.token // ini snapToken yang dikirim ke frontend
  },

  // Verifikasi notifikasi dari webhook Midtrans
  // Penting: selalu verifikasi signature key untuk keamanan
  async verifyWebhook(notification: Record<string, string>) {
    const core = getCoreClient()
    const statusResponse = await core.transaction.notification(notification)
    return statusResponse
  },
}
