// src/controllers/auth.controller.ts
// Handle login admin dan refresh token.

import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/utils/prisma'
import { sendSuccess, sendError } from '@/utils/response'
import { z } from 'zod'

// Validasi input login dengan Zod
const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const authController = {
  // POST /api/auth/login
  async login(req: Request, res: Response) {
    // Validasi input
    const result = loginSchema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, 'Input tidak valid', 400, result.error.flatten())
    }

    const { email, password } = result.data

    // Cari admin berdasarkan email
    const admin = await prisma.admin.findUnique({ where: { email } })
    if (!admin) {
      // Jangan kasih tahu apakah email atau password yang salah (security)
      return sendError(res, 'Email atau password salah', 401)
    }

    // Bandingkan password dengan hash di database
    const isPasswordValid = await bcrypt.compare(password, admin.password)
    if (!isPasswordValid) {
      return sendError(res, 'Email atau password salah', 401)
    }

    // Buat JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    )

    return sendSuccess(res, {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    }, 'Login berhasil')
  },

  // GET /api/auth/me — cek token masih valid
  async me(req: Request, res: Response) {
    // Data admin sudah di-inject oleh authMiddleware
    const authReq = req as any
    return sendSuccess(res, { admin: authReq.admin })
  },
}
