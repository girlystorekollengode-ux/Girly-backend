import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import User from './models/User.js';
import Coupon from './models/Coupon.js';
import slugify from 'slugify';

dotenv.config();

const priceRanges = [
  { label: 'Under ₹199', min: 0, max: 199 },
  { label: '₹200 – ₹299', min: 200, max: 299 },
  { label: '₹300 – ₹499', min: 300, max: 499 },
  { label: '₹500 – ₹999', min: 500, max: 999 },
  { label: 'Above ₹999', min: 1000, max: 999999 },
];

const categoriesData = [
  {
    name: 'T-Shirts',
    slug: 't-shirts',
    displayOrder: 1,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&q=80&w=400', public_id: 'seed/tshirts' },
  },
  {
    name: 'Tops',
    slug: 'tops',
    displayOrder: 2,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=400', public_id: 'seed/tops' },
  },
  {
    name: 'Western Wears',
    slug: 'western-wears',
    displayOrder: 3,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=400', public_id: 'seed/western' },
  },
  {
    name: 'Co-ord Sets',
    slug: 'co-ord-sets',
    displayOrder: 4,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=400', public_id: 'seed/coords' },
  },
  {
    name: 'Korean Night Wears',
    slug: 'korean-night-wears',
    displayOrder: 5,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=400', public_id: 'seed/nightwear' },
  },
  {
    name: 'Jeans',
    slug: 'jeans',
    displayOrder: 6,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=400', public_id: 'seed/jeans' },
  },
  {
    name: 'Churidar Sets',
    slug: 'churidar-sets',
    displayOrder: 7,
    priceRanges,
    image: { url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=400', public_id: 'seed/churidar' },
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔄 Connected to database for seeding...');

    // Clear existing data
    await Category.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();
    await Coupon.deleteMany();
    console.log('🧹 Cleaned existing categories, products, users, and coupons.');

    // Seed Categories
    const seededCategories = await Category.insertMany(categoriesData);
    console.log('🎉 seeded categories successfully.');

    // Map categories by slug for product insertion
    const categoryMap = {};
    seededCategories.forEach((cat) => {
      categoryMap[cat.slug] = cat._id;
    });

    // Seed Users
    const admin = await User.create({
      name: 'Girly Admin',
      email: 'admin@girly.com',
      password: 'adminpassword123',
      phone: '81298898313',
      role: 'admin',
      addresses: [
        {
          label: 'Store Location',
          street: 'Block Office Road, Opposite Thrissur Gold Palace, Near Federal Bank',
          city: 'Kollengode',
          state: 'Kerala',
          pincode: '678506',
          isDefault: true,
        },
      ],
    });

    const user = await User.create({
      name: 'Anjali Menon',
      email: 'user@girly.com',
      password: 'userpassword123',
      phone: '7012065738',
      role: 'user',
      addresses: [
        {
          label: 'Home',
          street: '12/456 Lotus Lane',
          city: 'Thrissur',
          state: 'Kerala',
          pincode: '680001',
          isDefault: true,
        },
      ],
    });

    console.log('🎉 Seeded admin user (admin@girly.com / adminpassword123) and standard user (user@girly.com / userpassword123).');

    // Seed Coupons
    await Coupon.create([
      {
        code: 'WELCOME50',
        discountType: 'flat',
        value: 50,
        minOrderAmount: 299,
        maxUses: 100,
        expiryDate: new Date('2027-12-31'),
      },
      {
        code: 'GIRLY10',
        discountType: 'percent',
        value: 10,
        minOrderAmount: 499,
        maxUses: null,
        expiryDate: new Date('2027-12-31'),
      },
    ]);
    console.log('🎉 Seeded sample coupons.');

    // Seed Sample Products
    const productsData = [
      // 1. T-Shirts (starting ₹99)
      {
        name: 'Basic Pastel Pink V-Neck Tee',
        description: 'Cotton blend basic v-neck tee, soft fabric for daily comfort wearing.',
        images: [{ url: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_tshirt1' }],
        price: 199,
        discountPrice: 99,
        category: categoryMap['t-shirts'],
        subcategory: 'V-Neck',
        stock: 50,
        sizes: ['S', 'M', 'L'],
        colors: ['Pastel Pink', 'White'],
        tags: ['cotton', 'tshirt', 'casual'],
        isFeatured: true,
      },
      {
        name: 'Graphic Print Boyfriend Tee',
        description: 'Casual oversized graphic printed black t-shirt for cool look.',
        images: [{ url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_tshirt2' }],
        price: 399,
        discountPrice: 249,
        category: categoryMap['t-shirts'],
        subcategory: 'Oversized',
        stock: 35,
        sizes: ['M', 'L', 'XL'],
        colors: ['Black', 'Grey'],
        tags: ['printed', 'tshirt', 'boyfriend'],
        isFeatured: false,
      },
      // 2. Tops (starting ₹169)
      {
        name: 'Elegant Floral Smocked Top',
        description: 'Beautiful crop smocked floral top with puff sleeves.',
        images: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_top1' }],
        price: 299,
        discountPrice: 169,
        category: categoryMap['tops'],
        subcategory: 'Crop Tops',
        stock: 40,
        sizes: ['XS', 'S', 'M'],
        colors: ['Blue Floral', 'Red Floral'],
        tags: ['floral', 'top', 'summer'],
        isFeatured: true,
      },
      // 3. Western Wears (starting ₹179)
      {
        name: 'Classic A-Line Summer Dress',
        description: 'A-line light yellow summer dress with shoulder ties, elegant styling.',
        images: [{ url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_western1' }],
        price: 399,
        discountPrice: 179,
        category: categoryMap['western-wears'],
        subcategory: 'Dresses',
        stock: 25,
        sizes: ['S', 'M', 'L'],
        colors: ['Yellow', 'Mint Green'],
        tags: ['dress', 'summer', 'western'],
        isFeatured: true,
      },
      // 4. Co-ord Sets (starting ₹299)
      {
        name: 'Floral Print Linen Co-ord Set',
        description: 'Double breasted linen button down shirt and shorts matching set.',
        images: [{ url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_coord1' }],
        price: 599,
        discountPrice: 299,
        category: categoryMap['co-ord-sets'],
        subcategory: 'Linen Sets',
        stock: 20,
        sizes: ['S', 'M', 'L'],
        colors: ['Beige', 'Sage Green'],
        tags: ['matching', 'set', 'coord'],
        isFeatured: true,
      },
      // 5. Korean Night Wears (starting ₹159)
      {
        name: 'Cute Peach Printed Satin Nighty',
        description: 'Smooth satin slip night dress with lovely peach patterns, Korean style.',
        images: [{ url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_night1' }],
        price: 299,
        discountPrice: 159,
        category: categoryMap['korean-night-wears'],
        subcategory: 'Satin Pajamas',
        stock: 30,
        sizes: ['Free Size'],
        colors: ['Peach Pink', 'Lilac'],
        tags: ['nightwear', 'korean', 'satin'],
        isFeatured: false,
      },
      // 6. Jeans (starting ₹439)
      {
        name: 'High Waist Wide Leg Denim Jeans',
        description: 'Trendy high waisted wide leg washed blue denim jeans.',
        images: [{ url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_jeans1' }],
        price: 899,
        discountPrice: 439,
        category: categoryMap['jeans'],
        subcategory: 'Wide Leg',
        stock: 30,
        sizes: ['28', '30', '32'],
        colors: ['Light Blue', 'Dark Denim'],
        tags: ['jeans', 'denim', 'pants'],
        isFeatured: true,
      },
      // 7. Churidar Sets (starting ₹499)
      {
        name: 'Festive Cotton Printed Anarkali Churidar',
        description: 'Beautiful hand block printed pink cotton anarkali kurta, pant and dupatta set.',
        images: [{ url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800', public_id: 'seed/prod_churidar1' }],
        price: 999,
        discountPrice: 499,
        category: categoryMap['churidar-sets'],
        subcategory: 'Cotton Salwars',
        stock: 15,
        sizes: ['M', 'L', 'XL', 'XXL'],
        colors: ['Rose Pink', 'Mint Floral'],
        tags: ['churidar', 'indian', 'salwar'],
        isFeatured: true,
      },
    ];

    const productsWithSlugs = productsData.map((p) => ({
      ...p,
      slug: `${slugify(p.name, { lower: true })}-${Date.now()}`,
    }));

    await Product.insertMany(productsWithSlugs);
    console.log('🎉 Seeded sample products matching all starting prices successfully.');

    console.log('✅ Seeding database complete! Exiting...');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seedDB();
