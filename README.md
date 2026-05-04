# Resto App — Backend (Express + Prisma)

## Struktur Project

```
src/
├── controllers/
│   ├── auth.controller.ts      # Login admin
│   ├── menu.controller.ts      # CRUD menu & kategori
│   └── order.controller.ts     # Buat order, update status, webhook
├── middleware/
│   └── auth.ts                 # JWT middleware untuk route admin
├── routes/
│   └── index.ts                # Daftar semua route API
├── services/
│   ├── email.service.ts        # Kirim email via Nodemailer
│   └── midtrans.service.ts     # Integrasi Midtrans Snap
├── utils/
│   ├── prisma.ts               # Singleton Prisma client
│   └── response.ts             # Helper format response API
└── index.ts                    # Entry point Express app
prisma/
├── schema.prisma               # Database schema
└── seed.ts                     # Data awal (admin + menu)
```

## Setup Langkah demi Langkah

### 1. Install PostgreSQL
Download dari: https://www.postgresql.org/download/windows/
- Saat install, catat username (default: `postgres`) dan password yang kamu set
- Setelah install, buka pgAdmin atau psql dan buat database baru:
  ```sql
  CREATE DATABASE resto_app;
  ```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
```bash
copy .env.example .env
```
Edit file `.env` dan isi semua nilai yang diperlukan, terutama:
- `DATABASE_URL` — sesuaikan username, password, dan nama database
- `JWT_SECRET` — generate string random: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` — dari dashboard Midtrans sandbox
- `EMAIL_USER` dan `EMAIL_PASS` — Gmail + App Password

### 4. Generate Prisma client dan jalankan migrasi
```bash
npm run db:generate
npm run db:migrate
```
Saat diminta nama migrasi, ketik: `init`

### 5. Seed data awal
```bash
npm run db:seed
```
Ini akan membuat:
- Admin: admin@warungbarokah.com / admin123
- 4 kategori
- 11 menu item

### 6. Jalankan server
```bash
npm run dev
```
Server berjalan di: http://localhost:3001

---

## Daftar API Endpoint

### Auth
| Method | URL | Keterangan |
|--------|-----|------------|
| POST | /api/auth/login | Login admin |
| GET | /api/auth/me | Cek token admin |

### Menu (Publik)
| Method | URL | Keterangan |
|--------|-----|------------|
| GET | /api/menu | Semua menu (filter: ?category=main&search=nasi) |
| GET | /api/menu/categories | Semua kategori |
| GET | /api/menu/:id | Detail satu menu item |

### Menu (Admin — butuh token)
| Method | URL | Keterangan |
|--------|-----|------------|
| POST | /api/admin/menu | Tambah menu item |
| PUT | /api/admin/menu/:id | Edit menu item |
| DELETE | /api/admin/menu/:id | Hapus menu item |
| PATCH | /api/admin/menu/:id/toggle | Toggle tersedia/tidak |

### Order
| Method | URL | Keterangan |
|--------|-----|------------|
| POST | /api/orders | Buat order baru |
| GET | /api/orders/:id | Cek status order |
| GET | /api/admin/orders | List semua order (admin) |
| PATCH | /api/admin/orders/:id/status | Update status order (admin) |
| POST | /api/payment/webhook | Webhook Midtrans |

---

## Koneksi ke Frontend

Setelah backend jalan, update `src/app/checkout/page.tsx` di frontend:
Ganti mock handleSubmit dengan versi API asli (ada di komentar kode).

Juga update `src/app/order/[id]/page.tsx`:
```typescript
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${id}`)
const data = await res.json()
setOrder(data.data)
```

Dan `src/app/page.tsx` untuk fetch menu dari API:
```typescript
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/menu`)
const data = await res.json()
// gunakan data.data sebagai menuItems
```

---

## Setup Midtrans Sandbox

1. Daftar di https://dashboard.sandbox.midtrans.com
2. Login → Settings → Access Keys
3. Copy **Server Key** dan **Client Key** ke `.env`
4. Settings → Configuration → Payment Notification URL:
   Isi dengan URL webhook kamu (butuh ngrok untuk local testing):
   ```
   https://xxxx.ngrok.io/api/payment/webhook
   ```
5. Install ngrok: https://ngrok.com/download
   Jalankan: `ngrok http 3001`

## Setup Email Gmail

1. Buka https://myaccount.google.com/security
2. Aktifkan 2-Step Verification
3. Buka https://myaccount.google.com/apppasswords
4. Buat App Password baru untuk "Mail"
5. Copy password 16 digit ke `EMAIL_PASS` di `.env`
   (bukan password Gmail biasa!)
