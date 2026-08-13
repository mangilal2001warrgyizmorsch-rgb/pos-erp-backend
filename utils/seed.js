import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Customer from '../models/Customer.js';

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});

    console.log('Cleared existing data');

    // Create users
    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@poserp.com',
        password: 'admin123',
        role: 'admin',
        phone: '1234567890',
      },
      {
        name: 'Manager User',
        email: 'manager@poserp.com',
        password: 'manager123',
        role: 'manager',
        phone: '1122334455',
      },
      {
        name: 'Accountant User',
        email: 'accountant@poserp.com',
        password: 'accountant123',
        role: 'accountant',
        phone: '5544332211',
      },
      {
        name: 'Stock Manager User',
        email: 'stockmanager@poserp.com',
        password: 'stockmanager123',
        role: 'stock_manager',
        phone: '6677889900',
      },
      {
        name: 'Cashier User',
        email: 'cashier@poserp.com',
        password: 'cashier123',
        role: 'cashier',
        phone: '0987654321',
      },
    ]);
    console.log('Users seeded');

    // Create categories
    const categories = await Category.create([
      { name: 'Electronics', description: 'Electronic gadgets and accessories' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Groceries', description: 'Food and daily essentials' },
      { name: 'Beverages', description: 'Drinks and liquid items' },
      { name: 'Home & Kitchen', description: 'Home appliances and kitchenware' },
      { name: 'Health & Beauty', description: 'Personal care and beauty products' },
      { name: 'Stationery', description: 'Office and school supplies' },
      { name: 'Sports', description: 'Sports equipment and accessories' },
    ]);
    console.log('Categories seeded');

    // Create products
    const products = await Product.create([
      {
        name: 'Wireless Bluetooth Earbuds',
        sku: 'ELEC-001',
        barcode: '8901234567890',
        description: 'Premium wireless earbuds with noise cancellation',
        category: categories[0]._id,
        purchasePrice: 1200,
        sellingPrice: 2499,
        stock: 50,
        lowStockThreshold: 10,
        unit: 'piece',
      },
      {
        name: 'USB-C Fast Charger',
        sku: 'ELEC-002',
        barcode: '8901234567891',
        description: '65W USB-C PD fast charger',
        category: categories[0]._id,
        purchasePrice: 450,
        sellingPrice: 899,
        stock: 100,
        lowStockThreshold: 15,
        unit: 'piece',
      },
      {
        name: 'Smartphone Screen Protector',
        sku: 'ELEC-003',
        barcode: '8901234567892',
        description: 'Tempered glass screen protector',
        category: categories[0]._id,
        purchasePrice: 50,
        sellingPrice: 199,
        stock: 200,
        lowStockThreshold: 20,
        unit: 'piece',
      },
      {
        name: 'Cotton T-Shirt (White)',
        sku: 'CLO-001',
        barcode: '8901234567893',
        description: 'Premium cotton round-neck t-shirt',
        category: categories[1]._id,
        purchasePrice: 180,
        sellingPrice: 499,
        stock: 75,
        lowStockThreshold: 10,
        unit: 'piece',
      },
      {
        name: 'Denim Jeans (Blue)',
        sku: 'CLO-002',
        barcode: '8901234567894',
        description: 'Classic fit denim jeans',
        category: categories[1]._id,
        purchasePrice: 600,
        sellingPrice: 1299,
        stock: 40,
        lowStockThreshold: 8,
        unit: 'piece',
      },
      {
        name: 'Basmati Rice (5kg)',
        sku: 'GRO-001',
        barcode: '8901234567895',
        description: 'Premium aged basmati rice',
        category: categories[2]._id,
        purchasePrice: 280,
        sellingPrice: 450,
        stock: 30,
        lowStockThreshold: 10,
        unit: 'kg',
      },
      {
        name: 'Olive Oil (1L)',
        sku: 'GRO-002',
        barcode: '8901234567896',
        description: 'Extra virgin olive oil',
        category: categories[2]._id,
        purchasePrice: 350,
        sellingPrice: 599,
        stock: 45,
        lowStockThreshold: 10,
        unit: 'liter',
      },
      {
        name: 'Green Tea (100 bags)',
        sku: 'BEV-001',
        barcode: '8901234567897',
        description: 'Organic green tea bags',
        category: categories[3]._id,
        purchasePrice: 120,
        sellingPrice: 299,
        stock: 60,
        lowStockThreshold: 12,
        unit: 'box',
      },
      {
        name: 'Coffee Beans (500g)',
        sku: 'BEV-002',
        barcode: '8901234567898',
        description: 'Arabica coffee beans, medium roast',
        category: categories[3]._id,
        purchasePrice: 250,
        sellingPrice: 549,
        stock: 35,
        lowStockThreshold: 8,
        unit: 'piece',
      },
      {
        name: 'Stainless Steel Water Bottle',
        sku: 'HK-001',
        barcode: '8901234567899',
        description: '1L insulated water bottle',
        category: categories[4]._id,
        purchasePrice: 200,
        sellingPrice: 499,
        stock: 80,
        lowStockThreshold: 15,
        unit: 'piece',
      },
      {
        name: 'Non-Stick Frying Pan',
        sku: 'HK-002',
        barcode: '8901234567900',
        description: '28cm ceramic non-stick pan',
        category: categories[4]._id,
        purchasePrice: 450,
        sellingPrice: 999,
        stock: 25,
        lowStockThreshold: 5,
        unit: 'piece',
      },
      {
        name: 'Face Moisturizer (100ml)',
        sku: 'HB-001',
        barcode: '8901234567901',
        description: 'Daily hydrating moisturizer',
        category: categories[5]._id,
        purchasePrice: 150,
        sellingPrice: 349,
        stock: 5,
        lowStockThreshold: 10,
        unit: 'piece',
      },
      {
        name: 'Sunscreen SPF 50 (50ml)',
        sku: 'HB-002',
        barcode: '8901234567902',
        description: 'Broad spectrum sun protection',
        category: categories[5]._id,
        purchasePrice: 200,
        sellingPrice: 450,
        stock: 3,
        lowStockThreshold: 8,
        unit: 'piece',
      },
      {
        name: 'Notebook A4 (200 pages)',
        sku: 'STA-001',
        barcode: '8901234567903',
        description: 'Ruled notebook for office use',
        category: categories[6]._id,
        purchasePrice: 40,
        sellingPrice: 99,
        stock: 150,
        lowStockThreshold: 20,
        unit: 'piece',
      },
      {
        name: 'Yoga Mat (6mm)',
        sku: 'SPO-001',
        barcode: '8901234567904',
        description: 'Anti-slip exercise yoga mat',
        category: categories[7]._id,
        purchasePrice: 300,
        sellingPrice: 699,
        stock: 20,
        lowStockThreshold: 5,
        unit: 'piece',
      },
    ]);
    console.log('Products seeded');

    // Create customers
    const customers = await Customer.create([
      {
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        phone: '9876543210',
        address: '123, MG Road, Bangalore',
        totalPurchases: 5,
        totalSpent: 12500,
      },
      {
        name: 'Priya Patel',
        email: 'priya@example.com',
        phone: '9876543211',
        address: '456, Park Street, Mumbai',
        totalPurchases: 3,
        totalSpent: 8900,
      },
      {
        name: 'Amit Kumar',
        email: 'amit@example.com',
        phone: '9876543212',
        address: '789, Nehru Nagar, Delhi',
        totalPurchases: 8,
        totalSpent: 25000,
      },
      {
        name: 'Sneha Reddy',
        email: 'sneha@example.com',
        phone: '9876543213',
        address: '321, Jubilee Hills, Hyderabad',
        totalPurchases: 2,
        totalSpent: 5600,
      },
      {
        name: 'Vikram Singh',
        email: 'vikram@example.com',
        phone: '9876543214',
        address: '654, Civil Lines, Jaipur',
        totalPurchases: 6,
        totalSpent: 18750,
      },
    ]);
    console.log('Customers seeded');

    console.log('\n=== Seed Data Complete ===');
    console.log(`Users: ${users.length}`);
    console.log(`Categories: ${categories.length}`);
    console.log(`Products: ${products.length}`);
    console.log(`Customers: ${customers.length}`);
    console.log('\nLogin Credentials:');
    console.log('Admin: admin@poserp.com / admin123');
    console.log('Cashier: cashier@poserp.com / cashier123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
