// src/routes/index.ts
// UPDATED: tambah route laporan admin

import { Router } from 'express'
import { authController } from '@/controllers/auth.controller'
import { menuController } from '@/controllers/menu.controller'
import { orderController } from '@/controllers/order.controller'
import { laporanController } from '@/controllers/laporan.controller'
import { authMiddleware } from '@/middleware/auth'

const router = Router()

// ─── Auth ─────────────────────────────────────────────────────
router.post('/auth/login', authController.login)
router.get('/auth/me', authMiddleware, authController.me)

// ─── Menu (Publik) ────────────────────────────────────────────
router.get('/menu', menuController.getAll)
router.get('/menu/categories', menuController.getCategories)
router.get('/menu/:id', menuController.getOne)

// ─── Menu (Admin) ─────────────────────────────────────────────
router.post('/admin/menu', authMiddleware, menuController.create)
router.put('/admin/menu/:id', authMiddleware, menuController.update)
router.delete('/admin/menu/:id', authMiddleware, menuController.delete)
router.patch('/admin/menu/:id/toggle', authMiddleware, menuController.toggleAvailability)

// ─── Orders (Publik) ──────────────────────────────────────────
router.post('/orders', orderController.create)
router.get('/orders', orderController.getByPhone)
router.get('/orders/:id/snap-token', orderController.getSnapToken)
router.get('/orders/:id', orderController.getOne)

// ─── Orders (Admin) ───────────────────────────────────────────
router.get('/admin/orders', authMiddleware, orderController.getAll)
router.patch('/admin/orders/:id/status', authMiddleware, orderController.updateStatus)

// ─── Laporan (Admin) ──────────────────────────────────────────
// GET /api/admin/laporan/summary → data statistik & grafik
// GET /api/admin/laporan/export  → download Excel (?from=2024-01-01&to=2024-01-31)
router.get('/admin/laporan/summary', authMiddleware, laporanController.getSummary)
router.get('/admin/laporan/export', authMiddleware, laporanController.exportExcel)

// ─── Payment Webhook ──────────────────────────────────────────
router.post('/payment/webhook', orderController.midtransWebhook)

export default router
