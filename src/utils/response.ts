// src/utils/response.ts
// Helper untuk format response API yang konsisten.
// Semua endpoint pakai format yang sama supaya frontend mudah handle.

import { Response } from 'express'

type SuccessResponse<T> = {
  success: true
  data: T
  message?: string
}

type ErrorResponse = {
  success: false
  error: string
  details?: unknown
}

// Kirim response sukses
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
) {
  const body: SuccessResponse<T> = { success: true, data }
  if (message) body.message = message
  return res.status(statusCode).json(body)
}

// Kirim response error
export function sendError(
  res: Response,
  error: string,
  statusCode = 400,
  details?: unknown
) {
  const body: ErrorResponse = { success: false, error }
  if (details) body.details = details
  return res.status(statusCode).json(body)
}

// Format harga ke Rupiah (untuk log / email)
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}
