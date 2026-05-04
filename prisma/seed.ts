// prisma/seed.ts
// Data awal untuk database.
// Jalankan: npm run db:seed
// Akan membuat: 1 admin, 4 kategori, 11 menu item

import { PrismaClient, PaymentMethod } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Admin ─────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@warungbarokah.com' },
    update: {},
    create: {
      name: 'Admin Warung Barokah',
      email: 'admin@warungbarokah.com',
      password: hashedPassword,
    },
  })
  console.log('✅ Admin created:', admin.email)

  // ─── Categories ────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'main' },
      update: {},
      create: { name: 'Makanan Utama', slug: 'main', order: 1 },
    }),
    prisma.category.upsert({
      where: { slug: 'snack' },
      update: {},
      create: { name: 'Camilan', slug: 'snack', order: 2 },
    }),
    prisma.category.upsert({
      where: { slug: 'drink' },
      update: {},
      create: { name: 'Minuman', slug: 'drink', order: 3 },
    }),
    prisma.category.upsert({
      where: { slug: 'dessert' },
      update: {},
      create: { name: 'Dessert', slug: 'dessert', order: 4 },
    }),
  ])
  console.log('✅ Categories created:', categories.length)

  const [main, snack, drink, dessert] = categories

  // ─── Menu Items ────────────────────────────────────────────
  const menuData = [
    {
      name: 'Nasi Goreng Spesial',
      description: 'Nasi goreng dengan telur, ayam, udang, dan kerupuk. Bumbu rahasia chef kami.',
      price: 35000,
      image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80',
      categoryId: main.id,
      isAvailable: true,
      isBestSeller: true,
      isSpicy: false,
      order: 1,
    },
    {
      name: 'Ayam Bakar Madu',
      description: 'Ayam kampung dibakar dengan olesan madu dan rempah pilihan.',
      price: 45000,
      image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400&q=80',
      categoryId: main.id,
      isAvailable: true,
      isBestSeller: true,
      isSpicy: false,
      order: 2,
    },
    {
      name: 'Mie Pedas Level 5',
      description: 'Mie kuah dengan cabai rawit, topping sosis dan bakso.',
      price: 28000,
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80',
      categoryId: main.id,
      isAvailable: true,
      isBestSeller: false,
      isSpicy: true,
      order: 3,
    },
    {
      name: 'Sate Ayam (10 tusuk)',
      description: 'Sate ayam empuk dengan bumbu kacang dan lontong.',
      price: 32000,
      image: 'https://images.unsplash.com/photo-1529563021893-cc83c992d75d?w=400&q=80',
      categoryId: main.id,
      isAvailable: true,
      isBestSeller: false,
      isSpicy: false,
      order: 4,
    },
    {
      name: 'Kentang Goreng Crispy',
      description: 'Kentang goreng renyah dengan saus keju dan saus tomat.',
      price: 18000,
      image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&q=80',
      categoryId: snack.id,
      isAvailable: true,
      isBestSeller: false,
      isSpicy: false,
      order: 1,
    },
    {
      name: 'Cireng Bumbu Rujak',
      description: 'Cireng aci goreng dengan bumbu rujak pedas manis.',
      price: 15000,
      image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=400&q=80',
      categoryId: snack.id,
      isAvailable: true,
      isBestSeller: true,
      isSpicy: true,
      order: 2,
    },
    {
      name: 'Es Teh Manis',
      description: 'Teh manis segar dengan es batu.',
      price: 8000,
      image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
      categoryId: drink.id,
      isAvailable: true,
      isBestSeller: false,
      isSpicy: false,
      order: 1,
    },
    {
      name: 'Jus Alpukat',
      description: 'Jus alpukat creamy dengan susu coklat dan es serut.',
      price: 18000,
      image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&q=80',
      categoryId: drink.id,
      isAvailable: true,
      isBestSeller: true,
      isSpicy: false,
      order: 2,
    },
    {
      name: 'Es Kopi Susu',
      description: 'Kopi robusta lokal dengan susu segar dan gula aren.',
      price: 22000,
      image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80',
      categoryId: drink.id,
      isAvailable: true,
      isBestSeller: true,
      isSpicy: false,
      order: 3,
    },
    {
      name: 'Klepon Ice Cream',
      description: 'Es krim vanilla dengan topping klepon, kelapa parut, dan gula merah cair.',
      price: 25000,
      image: 'https://images.unsplash.com/photo-1631206753348-db44968fd440?w=400&q=80',
      categoryId: dessert.id,
      isAvailable: false,
      isBestSeller: false,
      isSpicy: false,
      order: 1,
    },
    {
      name: 'Pisang Goreng Coklat',
      description: 'Pisang kepok goreng crispy dengan saus coklat dan keju parut.',
      price: 20000,
      image: 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=400&q=80',
      categoryId: dessert.id,
      isAvailable: true,
      isBestSeller: false,
      isSpicy: false,
      order: 2,
    },
  ]

  for (const item of menuData) {
    await prisma.menuItem.upsert({
      where: { id: item.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: { id: item.name.toLowerCase().replace(/\s+/g, '-'), ...item },
    })
  }
  console.log('✅ Menu items created:', menuData.length)
  console.log('\n🎉 Seeding selesai!')
  console.log('📧 Login admin: admin@warungbarokah.com')
  console.log('🔑 Password: admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
