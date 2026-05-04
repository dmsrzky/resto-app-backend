// src/middleware/auth.ts
// Middleware JWT untuk proteksi route admin.
// Cara pakai: tambahkan `authMiddleware` sebelum handler di route admin.
//
// Contoh: router.get('/menu', authMiddleware, menuController.getAll)

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '@/utils/response'

// Extend Express Request supaya bisa simpan data admin dari token
export interface AuthRequest extends Request {
  admin?: {
    id: string
    email: string
    name: string
  }
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Token dikirim via header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Token tidak ditemukan. Silakan login.', 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      email: string
      name: string
    }
    req.admin = decoded
    next()
  } catch {
    return sendError(res, 'Token tidak valid atau sudah expired.', 401)
  }
}
