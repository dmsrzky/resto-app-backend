// src/controllers/menu.controller.ts
// CRUD untuk menu item dan kategori.
// GET endpoints: publik (customer bisa akses)
// POST/PUT/DELETE endpoints: hanya admin (pakai authMiddleware)

import { Request, Response } from 'express'
import { prisma } from '@/utils/prisma'
import { sendSuccess, sendError } from '@/utils/response'
import { z } from 'zod'

// Validasi untuk create/update menu item
const menuItemSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  description: z.string().min(1, 'Deskripsi wajib diisi'),
  price: z.number().int().positive('Harga harus lebih dari 0'),
  image: z.string().url('URL gambar tidak valid'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  isAvailable: z.boolean().default(true),
  isBestSeller: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  order: z.number().int().default(0),
})

export const menuController = {

  // ─── GET /api/menu ─────────────────────────────────────────
  // Publik: ambil semua menu yang tersedia, dikelompokkan per kategori
  async getAll(req: Request, res: Response) {
    const { category, search, available } = req.query

    const where: any = {}

    // Filter berdasarkan kategori (slug)
    if (category && category !== 'all') {
      where.category = { slug: category as string }
    }

    // Filter berdasarkan pencarian nama
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' }
    }

    // Filter hanya yang tersedia (default: semua)
    if (available === 'true') {
      where.isAvailable = true
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }],
    })

    return sendSuccess(res, items)
  },

  // ─── GET /api/menu/categories ──────────────────────────────
  // Publik: ambil semua kategori
  async getCategories(req: Request, res: Response) {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { menuItems: true } }, // jumlah item per kategori
      },
    })
    return sendSuccess(res, categories)
  },

  // ─── GET /api/menu/:id ─────────────────────────────────────
  // Publik: detail satu menu item
  async getOne(req: Request, res: Response) {
    const { id } = req.params
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: { category: true },
    })
    if (!item) return sendError(res, 'Menu item tidak ditemukan', 404)
    return sendSuccess(res, item)
  },

  // ─── POST /api/admin/menu ──────────────────────────────────
  // Admin only: tambah menu item baru
  async create(req: Request, res: Response) {
    const result = menuItemSchema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'Input tidak valid', 400, result.error.flatten())
    }

    // Cek kategori exist
    const category = await prisma.category.findUnique({
      where: { id: result.data.categoryId },
    })
    if (!category) return sendError(res, 'Kategori tidak ditemukan', 404)

    const item = await prisma.menuItem.create({
      data: result.data,
      include: { category: true },
    })
    return sendSuccess(res, item, 'Menu item berhasil ditambahkan', 201)
  },

  // ─── PUT /api/admin/menu/:id ───────────────────────────────
  // Admin only: update menu item
  async update(req: Request, res: Response) {
    const { id } = req.params
    const result = menuItemSchema.partial().safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'Input tidak valid', 400, result.error.flatten())
    }

    const existing = await prisma.menuItem.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Menu item tidak ditemukan', 404)

    const item = await prisma.menuItem.update({
      where: { id },
      data: result.data,
      include: { category: true },
    })
    return sendSuccess(res, item, 'Menu item berhasil diupdate')
  },

  // ─── DELETE /api/admin/menu/:id ────────────────────────────
  // Admin only: hapus menu item
  // Catatan: tidak bisa hapus kalau masih ada order yang terkait
  async delete(req: Request, res: Response) {
    const { id } = req.params

    const existing = await prisma.menuItem.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    })
    if (!existing) return sendError(res, 'Menu item tidak ditemukan', 404)

    // Cegah hapus kalau sudah ada order
    if (existing._count.orderItems > 0) {
      return sendError(
        res,
        'Menu item tidak bisa dihapus karena sudah ada di dalam order. Nonaktifkan saja (isAvailable: false).',
        400
      )
    }

    await prisma.menuItem.delete({ where: { id } })
    return sendSuccess(res, null, 'Menu item berhasil dihapus')
  },

  // ─── PATCH /api/admin/menu/:id/toggle ─────────────────────
  // Admin only: toggle status tersedia/tidak tersedia
  async toggleAvailability(req: Request, res: Response) {
    const { id } = req.params
    const existing = await prisma.menuItem.findUnique({ where: { id } })
    if (!existing) return sendError(res, 'Menu item tidak ditemukan', 404)

    const item = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !existing.isAvailable },
    })
    return sendSuccess(
      res,
      item,
      `Menu item ${item.isAvailable ? 'diaktifkan' : 'dinonaktifkan'}`
    )
  },
}
