import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';

const PERIODS = {
  daily: { days: 1, groupFormat: '%Y-%m-%d', label: 'Daily' },
  weekly: { days: 7, groupFormat: '%Y-%m-%d', label: 'Weekly' },
  monthly: { days: 30, groupFormat: '%Y-%m-%d', label: 'Monthly' },
  yearly: { days: 365, groupFormat: '%Y-%m', label: 'Yearly' },
};

const toObjectId = (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const getDateRange = (query) => {
  const period = PERIODS[query.period] ? query.period : 'monthly';
  const end = query.endDate ? new Date(`${query.endDate}T23:59:59.999Z`) : new Date();
  const start = query.startDate ? new Date(query.startDate) : new Date(end);

  if (!query.startDate) {
    start.setDate(start.getDate() - PERIODS[period].days + 1);
    start.setHours(0, 0, 0, 0);
  }

  return {
    period,
    startDate: start,
    endDate: end,
    groupFormat: PERIODS[period].groupFormat,
  };
};

const money = (value = 0) => Number(Number(value || 0).toFixed(2));

const productFilterMatch = (query, prefix = '') => {
  const match = {};
  const category = toObjectId(query.category);
  const product = toObjectId(query.product);

  if (category) match[`${prefix}category`] = category;
  if (product) match[`${prefix}_id`] = product;
  if (query.search) {
    match.$or = [
      { [`${prefix}name`]: { $regex: query.search, $options: 'i' } },
      { [`${prefix}sku`]: { $regex: query.search, $options: 'i' } },
      { [`${prefix}barcode`]: { $regex: query.search, $options: 'i' } },
    ];
  }

  return match;
};

const saleMatch = (query, startDate, endDate) => {
  const match = {
    status: 'completed',
    createdAt: { $gte: startDate, $lte: endDate },
  };
  const customer = toObjectId(query.customer);

  if (customer) match.customer = customer;
  if (query.search) {
    match.$or = [
      { invoiceNumber: { $regex: query.search, $options: 'i' } },
      { customerName: { $regex: query.search, $options: 'i' } },
    ];
  }

  return match;
};

const purchaseMatch = (query, startDate, endDate) => {
  const match = {
    status: { $in: ['confirmed', 'received'] },
    createdAt: { $gte: startDate, $lte: endDate },
  };
  const supplier = toObjectId(query.supplier);

  if (supplier) match.supplier = supplier;
  if (query.search) {
    match.$or = [
      { purchaseNumber: { $regex: query.search, $options: 'i' } },
      { invoiceNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  return match;
};

const soldItemsWithProductStages = (query, { inventoryOnly = false } = {}) => {
  const category = toObjectId(query.category);
  const product = toObjectId(query.product);
  const stages = [
    { $unwind: '$items' },
  ];

  if (inventoryOnly) {
    stages.push({
      $match: {
        'items.product': { $ne: null },
        'items.affectsInventory': { $ne: false },
        'items.itemType': { $in: [null, 'inventory'] },
      },
    });
  }

  stages.push(
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  );

  if (product || category) {
    const match = {};
    if (product) match['items.product'] = product;
    if (category) match['product.category'] = category;
    stages.push({ $match: match });
  }

  return stages;
};

const purchasedItemsWithProductStages = (query) => {
  const category = toObjectId(query.category);
  const product = toObjectId(query.product);
  const stages = [
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  ];

  if (product || category) {
    const match = {};
    if (product) match['items.product'] = product;
    if (category) match['product.category'] = category;
    stages.push({ $match: match });
  }

  return stages;
};

// @desc    Advanced inventory analytics report
// @route   GET /api/reports/inventory
export const getInventoryReport = async (req, res, next) => {
  try {
    const { period, startDate, endDate, groupFormat } = getDateRange(req.query);
    const match = { isActive: true, ...productFilterMatch(req.query) };

    const [
      summaryResult,
      categoryAnalytics,
      stockOverview,
      inventoryValueChart,
      lowStockTrend,
      fastMovingProducts,
      deadStockProducts,
      products,
    ] = await Promise.all([
      Product.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            currentInventoryValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
            totalInventoryCost: { $sum: { $multiply: ['$stock', '$purchasePrice'] } },
            lowStockProducts: {
              $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] },
            },
            outOfStockProducts: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$category._id',
            category: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
            products: { $sum: 1 },
            stock: { $sum: '$stock' },
            inventoryValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
            inventoryCost: { $sum: { $multiply: ['$stock', '$purchasePrice'] } },
          },
        },
        { $sort: { inventoryValue: -1 } },
      ]),
      Product.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            inStock: {
              $sum: {
                $cond: [{ $and: [{ $gt: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] }, 1, 0],
              },
            },
            lowStock: {
              $sum: { $cond: [{ $and: [{ $lte: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] }, 1, 0] },
            },
            outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          },
        },
      ]),
      Product.aggregate([
        { $match: match },
        {
          $project: {
            name: 1,
            stock: 1,
            inventoryValue: { $multiply: ['$stock', '$sellingPrice'] },
            inventoryCost: { $multiply: ['$stock', '$purchasePrice'] },
            potentialProfit: { $multiply: ['$stock', { $subtract: ['$sellingPrice', '$purchasePrice'] }] },
          },
        },
        { $sort: { inventoryValue: -1 } },
        { $limit: 12 },
      ]),
      Product.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$updatedAt' } },
            lowStockProducts: {
              $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] },
            },
            outOfStockProducts: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: saleMatch(req.query, startDate, endDate) },
        ...soldItemsWithProductStages(req.query, { inventoryOnly: true }),
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            sku: { $first: '$items.sku' },
            quantitySold: { $sum: '$items.quantity' },
            salesValue: { $sum: '$items.total' },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),
      Product.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'sales',
            let: { productId: '$_id' },
            pipeline: [
              { $match: { status: 'completed', createdAt: { $gte: startDate, $lte: endDate } } },
              { $unwind: '$items' },
              { $match: { $expr: { $eq: ['$items.product', '$$productId'] } } },
              { $limit: 1 },
            ],
            as: 'recentSales',
          },
        },
        { $match: { recentSales: { $size: 0 }, stock: { $gt: 0 } } },
        { $project: { name: 1, sku: 1, barcode: 1, stock: 1, inventoryValue: { $multiply: ['$stock', '$sellingPrice'] } } },
        { $sort: { inventoryValue: -1 } },
        { $limit: 10 },
      ]),
      Product.find(match)
        .populate('category', 'name')
        .select('name sku barcode image category stock purchasePrice sellingPrice lowStockThreshold updatedAt')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const summary = summaryResult[0] || {};
    summary.potentialProfit = money((summary.currentInventoryValue || 0) - (summary.totalInventoryCost || 0));

    res.status(200).json({
      success: true,
      data: {
        meta: { period, startDate, endDate },
        summary: {
          totalProducts: summary.totalProducts || 0,
          currentInventoryValue: money(summary.currentInventoryValue),
          totalInventoryCost: money(summary.totalInventoryCost),
          potentialProfit: summary.potentialProfit,
          lowStockProducts: summary.lowStockProducts || 0,
          outOfStockProducts: summary.outOfStockProducts || 0,
        },
        charts: {
          stockOverview: stockOverview[0] || { inStock: 0, lowStock: 0, outOfStock: 0 },
          inventoryValue: inventoryValueChart,
          categoryWiseInventory: categoryAnalytics.map((item) => ({
            ...item,
            inventoryValue: money(item.inventoryValue),
            inventoryCost: money(item.inventoryCost),
            potentialProfit: money(item.inventoryValue - item.inventoryCost),
          })),
          lowStockTrend,
        },
        widgets: {
          lowStockAlerts: products.filter((product) => product.stock <= product.lowStockThreshold),
          fastMovingProducts,
          deadStockProducts,
          categoryAnalytics,
        },
        table: products.map((product) => ({
          productImage: product.image,
          productName: product.name,
          barcode: product.barcode,
          category: product.category?.name || 'Uncategorized',
          currentStock: product.stock,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          inventoryValue: money(product.stock * product.sellingPrice),
          status: product.stock === 0 ? 'Out of Stock' : product.stock <= product.lowStockThreshold ? 'Low Stock' : 'In Stock',
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Advanced sales and revenue analytics report
// @route   GET /api/reports/sales
export const getSalesReport = async (req, res, next) => {
  try {
    const { period, startDate, endDate, groupFormat } = getDateRange(req.query);
    const match = saleMatch(req.query, startDate, endDate);
    const expenseMatch = { date: { $gte: startDate, $lte: endDate } };

    const [
      salesSummary,
      purchaseCostSummary,
      expenseSummary,
      trend,
      expenseTrend,
      dailySalesCount,
      categoryWiseSales,
      topSellingProducts,
      sales,
    ] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
            totalDiscounts: { $sum: '$discountAmount' },
            totalTax: { $sum: '$taxAmount' },
            averageOrderValue: { $avg: '$totalAmount' },
          },
        },
      ]),
      Sale.aggregate([
        { $match: match },
        ...soldItemsWithProductStages(req.query),
        {
          $group: {
            _id: null,
            purchaseCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.purchasePrice', { $ifNull: ['$product.purchasePrice', 0] }] }] } },
            itemRevenue: { $sum: '$items.total' },
          },
        },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, expenses: { $sum: '$amount' } } },
      ]),
      Sale.aggregate([
        { $match: match },
        ...soldItemsWithProductStages(req.query),
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            totalSales: { $sum: '$items.total' },
            purchaseCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.purchasePrice', { $ifNull: ['$product.purchasePrice', 0] }] }] } },
            totalDiscounts: { $sum: '$discountAmount' },
            totalTax: { $sum: '$taxAmount' },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            totalSales: 1,
            purchaseCost: 1,
            totalDiscounts: 1,
            totalTax: 1,
            grossProfit: { $subtract: ['$totalSales', '$purchaseCost'] },
            salesCount: { $size: '$orders' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$date' } },
            expenses: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            salesCount: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: match },
        ...soldItemsWithProductStages(req.query),
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$category._id',
            category: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
            quantitySold: { $sum: '$items.quantity' },
            totalSales: { $sum: '$items.total' },
            purchaseCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.purchasePrice', { $ifNull: ['$product.purchasePrice', 0] }] }] } },
          },
        },
        { $sort: { totalSales: -1 } },
      ]),
      Sale.aggregate([
        { $match: match },
        ...soldItemsWithProductStages(req.query),
        {
          $group: {
            _id: {
              product: '$items.product',
              itemName: '$items.name',
              itemType: { $ifNull: ['$items.itemType', 'inventory'] },
            },
            productName: { $first: '$items.name' },
            sku: { $first: '$items.sku' },
            quantitySold: { $sum: '$items.quantity' },
            totalSales: { $sum: '$items.total' },
            purchaseCost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.purchasePrice', { $ifNull: ['$product.purchasePrice', 0] }] }] } },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),
      Sale.find(match)
        .populate('customer', 'name')
        .populate('items.product', 'purchasePrice category')
        .select('invoiceNumber customer customerName items subtotal totalAmount discountAmount taxAmount createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const salesTotals = salesSummary[0] || {};
    const purchaseCost = money(purchaseCostSummary[0]?.purchaseCost || 0);
    const expenses = money(expenseSummary[0]?.expenses || 0);
    const totalSales = money(salesTotals.totalSales || 0);
    const grossProfit = money(totalSales - purchaseCost);
    const totalRevenue = money(totalSales - purchaseCost - expenses);
    const expensesByPeriod = new Map(expenseTrend.map((item) => [item._id, item.expenses || 0]));

    res.status(200).json({
      success: true,
      data: {
        meta: { period, startDate, endDate, revenueFormula: 'totalSales - purchaseCost - expenses' },
        summary: {
          totalSales,
          totalRevenue,
          grossProfit,
          netProfit: totalRevenue,
          averageOrderValue: money(salesTotals.averageOrderValue),
          totalDiscounts: money(salesTotals.totalDiscounts),
          totalTax: money(salesTotals.totalTax),
          purchaseCost,
          expenses,
          orderCount: salesTotals.orderCount || 0,
        },
        charts: {
          salesTrend: trend.map((item) => ({ ...item, totalSales: money(item.totalSales) })),
          revenueTrend: trend.map((item) => ({
            _id: item._id,
            revenue: money(item.totalSales - item.purchaseCost - (expensesByPeriod.get(item._id) || 0)),
            purchaseCost: money(item.purchaseCost),
            expenses: money(expensesByPeriod.get(item._id) || 0),
          })),
          profitTrend: trend.map((item) => ({
            _id: item._id,
            grossProfit: money(item.grossProfit),
            netProfit: money(item.grossProfit - (expensesByPeriod.get(item._id) || 0)),
            profitMargin: item.totalSales ? money((item.grossProfit / item.totalSales) * 100) : 0,
          })),
          dailySalesCount,
          categoryWiseSales: categoryWiseSales.map((item) => ({
            ...item,
            totalSales: money(item.totalSales),
            profit: money(item.totalSales - item.purchaseCost),
          })),
          topSellingProducts: topSellingProducts.map((item) => ({
            ...item,
            totalSales: money(item.totalSales),
            profit: money(item.totalSales - item.purchaseCost),
          })),
        },
        table: sales.map((sale) => {
          const productId = toObjectId(req.query.product)?.toString();
          const categoryId = toObjectId(req.query.category)?.toString();
          const filteredItems = sale.items.filter((item) => {
            const itemProduct = item.product;
            if (productId && itemProduct?._id?.toString() !== productId) return false;
            if (categoryId && itemProduct?.category?.toString() !== categoryId) return false;
            return true;
          });
          const reportItems = productId || categoryId ? filteredItems : sale.items;
          if (reportItems.length === 0) return null;

          const itemCost = reportItems.reduce(
            (sum, item) => sum + item.quantity * (item.purchasePrice ?? item.product?.purchasePrice ?? 0),
            0
          );
          const itemTotal = reportItems.reduce((sum, item) => sum + item.total, 0);
          const discountShare = sale.subtotal ? (itemTotal / sale.subtotal) * (sale.discountAmount || 0) : sale.discountAmount || 0;
          const taxShare = sale.subtotal ? (itemTotal / sale.subtotal) * (sale.taxAmount || 0) : sale.taxAmount || 0;
          const revenue = itemTotal - itemCost - discountShare;
          return {
            invoiceNumber: sale.invoiceNumber,
            customerName: sale.customer?.name || sale.customerName,
            productsCount: reportItems.length,
            totalAmount: money(itemTotal - discountShare + taxShare),
            discount: money(discountShare),
            tax: money(taxShare),
            revenue: money(revenue),
            profit: money(revenue),
            date: sale.createdAt,
          };
        }).filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revenue breakdown report
// @route   GET /api/reports/revenue
export const getRevenueReport = async (req, res, next) => {
  return getSalesReport(req, res, next);
};

// @desc    Advanced purchase analytics report
// @route   GET /api/reports/purchases
export const getPurchaseReport = async (req, res, next) => {
  try {
    const { period, startDate, endDate, groupFormat } = getDateRange(req.query);
    const match = purchaseMatch(req.query, startDate, endDate);

    const [
      summary,
      purchaseTrend,
      supplierPurchaseChart,
      monthlyPurchaseAnalytics,
      purchaseCategoryChart,
      purchaseCostBreakdown,
      purchases,
    ] = await Promise.all([
      Purchase.aggregate([
        { $match: match },
        {
          $project: {
            supplier: 1,
            totalAmount: 1,
            amountPaid: 1,
            purchasedQuantity: { $sum: '$items.quantity' },
          },
        },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 },
            totalPurchaseAmount: { $sum: '$totalAmount' },
            supplierIds: { $addToSet: '$supplier' },
            averagePurchaseValue: { $avg: '$totalAmount' },
            pendingPayments: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
            totalPurchasedProducts: { $sum: '$purchasedQuantity' },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            totalPurchases: { $sum: 1 },
            totalPurchaseAmount: { $sum: '$totalAmount' },
            totalTax: { $sum: '$taxAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Purchase.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'suppliers',
            localField: 'supplier',
            foreignField: '_id',
            as: 'supplier',
          },
        },
        { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$supplier._id',
            supplierName: { $first: { $ifNull: ['$supplier.name', 'Unknown Supplier'] } },
            totalPurchases: { $sum: 1 },
            totalPurchaseAmount: { $sum: '$totalAmount' },
          },
        },
        { $sort: { totalPurchaseAmount: -1 } },
        { $limit: 10 },
      ]),
      Purchase.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            totalPurchases: { $sum: 1 },
            totalPurchaseAmount: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Purchase.aggregate([
        { $match: match },
        ...purchasedItemsWithProductStages(req.query),
        {
          $lookup: {
            from: 'categories',
            localField: 'product.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$category._id',
            category: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
            quantityPurchased: { $sum: '$items.quantity' },
            purchaseAmount: { $sum: '$items.total' },
          },
        },
        { $sort: { purchaseAmount: -1 } },
      ]),
      Purchase.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            amount: { $sum: '$totalAmount' },
            pendingAmount: { $sum: { $subtract: ['$totalAmount', '$amountPaid'] } },
          },
        },
        { $sort: { amount: -1 } },
      ]),
      Purchase.find(match)
        .populate('supplier', 'name')
        .select('purchaseNumber invoiceNumber supplier items totalAmount taxAmount status paymentStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const totals = summary[0] || {};

    res.status(200).json({
      success: true,
      data: {
        meta: { period, startDate, endDate },
        summary: {
          totalPurchases: totals.totalPurchases || 0,
          totalPurchaseAmount: money(totals.totalPurchaseAmount),
          supplierCount: totals.supplierIds?.length || 0,
          averagePurchaseValue: money(totals.averagePurchaseValue),
          pendingPayments: money(totals.pendingPayments),
          totalPurchasedProducts: totals.totalPurchasedProducts || 0,
        },
        charts: {
          purchaseTrend: purchaseTrend.map((item) => ({ ...item, totalPurchaseAmount: money(item.totalPurchaseAmount) })),
          supplierPurchaseChart: supplierPurchaseChart.map((item) => ({ ...item, totalPurchaseAmount: money(item.totalPurchaseAmount) })),
          monthlyPurchaseAnalytics: monthlyPurchaseAnalytics.map((item) => ({ ...item, totalPurchaseAmount: money(item.totalPurchaseAmount) })),
          purchaseCategoryChart: purchaseCategoryChart.map((item) => ({ ...item, purchaseAmount: money(item.purchaseAmount) })),
          purchaseCostBreakdown: purchaseCostBreakdown.map((item) => ({ ...item, amount: money(item.amount), pendingAmount: money(item.pendingAmount) })),
        },
        table: purchases.map((purchase) => ({
          purchaseInvoice: purchase.invoiceNumber || purchase.purchaseNumber,
          supplierName: purchase.supplier?.name || 'Unknown Supplier',
          productCount: purchase.items.length,
          purchaseAmount: money(purchase.totalAmount),
          tax: money(purchase.taxAmount),
          status: purchase.status,
          paymentStatus: purchase.paymentStatus,
          date: purchase.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
