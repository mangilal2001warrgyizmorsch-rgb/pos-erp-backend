import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
import PaymentIn from '../models/PaymentIn.js';
import PaymentOut from '../models/PaymentOut.js';



/**
 * Get date range based on period type
 */
const getDateRange = (period, customStartDate, customEndDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startDate, endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  if (period === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999);
  } else {
    switch (period) {
      case 'daily':
        startDate = new Date(today);
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
        break;
      case 'yearly':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      default:
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
    }
  }

  return { startDate, endDate };
};

/**
 * Get grouping format for aggregation
 */
const getGroupFormat = (period) => {
  switch (period) {
    case 'daily':
      return '%Y-%m-%d';
    case 'weekly':
      return '%Y-W%V';
    case 'monthly':
      return '%Y-%m';
    case 'yearly':
      return '%Y';
    default:
      return '%Y-%m-%d';
  }
};

// ==================== INVENTORY ANALYTICS ====================

export const getInventoryAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly', category, supplier } = req.query;

    // Summary cards data
    const matchStage = { isActive: true };
    if (category) matchStage.category = mongoose.Types.ObjectId(category);

    const inventoryStats = await Product.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          lowStockProducts: {
            $sum: { $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0] },
          },
          outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
          inventoryValue: {
            $sum: { $multiply: ['$stock', '$sellingPrice'] },
          },
          inventoryCost: {
            $sum: { $multiply: ['$stock', '$purchasePrice'] },
          },
          potentialProfit: {
            $sum: {
              $multiply: [
                '$stock',
                { $subtract: ['$sellingPrice', '$purchasePrice'] },
              ],
            },
          },
        },
      },
    ]);

    // Top products by stock
    const topProducts = await Product.find(matchStage)
      .sort({ stock: -1 })
      .limit(10)
      .select('name sku stock sellingPrice purchasePrice category');

    // Low stock products
    const lowStockProducts = await Product.find({
      ...matchStage,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .select('name sku stock lowStockThreshold sellingPrice purchasePrice')
      .limit(15);

    // Category-wise inventory
    const categoryInventory = await Product.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          categoryName: { $first: '$category' },
          totalValue: {
            $sum: { $multiply: ['$stock', '$sellingPrice'] },
          },
          productCount: { $sum: 1 },
          totalStock: { $sum: '$stock' },
        },
      },
      { $sort: { totalValue: -1 } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: { $arrayElemAt: ['$categoryDetails.name', 0] },
          totalValue: 1,
          productCount: 1,
          totalStock: 1,
        },
      },
    ]);

    // Stock trend - last 30 days sales impact
    const { startDate, endDate } = getDateRange(period);
    const stockTrend = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalUnitsSold: { $sum: '$items.quantity' },
          totalSalesValue: { $sum: '$items.total' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: inventoryStats[0] || {
          totalProducts: 0,
          totalStock: 0,
          lowStockProducts: 0,
          outOfStock: 0,
          inventoryValue: 0,
          inventoryCost: 0,
          potentialProfit: 0,
        },
        topProducts,
        lowStockProducts,
        categoryInventory,
        stockTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== SALES & REVENUE ANALYTICS ====================

export const getSalesAnalytics = async (req, res, next) => {
  try {
    const {
      period = 'monthly',
      category,
      product,
      customer,
      customStartDate,
      customEndDate,
    } = req.query;

    const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);
    const groupFormat = getGroupFormat(period);

    // Build match stages
    const matchStage = {
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // Sales trend data with proper grouping
    const salesTrend = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Sales summary
    const salesSummary = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalDiscount: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Get total purchase costs and expenses for revenue calculation
    const purchaseCosts = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPurchaseCost: { $sum: '$totalAmount' },
        },
      },
    ]);

    const totalExpenses = await Expense.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
        },
      },
    ]);

    const baseSalesSummary = salesSummary[0] || {
      totalSales: 0,
      totalAmount: 0,
      totalDiscount: 0,
      totalTax: 0,
      avgOrderValue: 0,
    };

    const purchaseCost = purchaseCosts[0]?.totalPurchaseCost || 0;
    const expenses = totalExpenses[0]?.totalExpenses || 0;

    // Calculate revenue = Sales - Purchase Cost - Expenses
    const revenue = baseSalesSummary.totalAmount - purchaseCost - expenses;
    const grossProfit = baseSalesSummary.totalAmount - purchaseCost;
    const netProfit = revenue;

    // Top selling products
    const topSellingProducts = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            product: '$items.product',
            itemName: '$items.name',
            itemType: { $ifNull: ['$items.itemType', 'inventory'] },
          },
          productName: { $first: '$items.name' },
          productSku: { $first: '$items.sku' },
          quantity: { $sum: '$items.quantity' },
          totalSales: { $sum: '$items.total' },
          avgPrice: { $avg: '$items.unitPrice' },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 },
    ]);

    // Category-wise sales
    const categoryWiseSales = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$productDetails.category', 0] },
          totalSales: { $sum: 1 },
          totalAmount: { $sum: '$items.total' },
          quantity: { $sum: '$items.quantity' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $project: {
          categoryName: { $arrayElemAt: ['$categoryDetails.name', 0] },
          totalSales: 1,
          totalAmount: 1,
          quantity: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Daily sales count
    const dailySalesCount = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Recent sales transactions
    const recentSales = await Sale.find(matchStage)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('invoiceNumber customerName items totalAmount discountAmount taxAmount totalAmount createdAt')
      .populate('customer', 'name phone');

    res.status(200).json({
      success: true,
      data: {
        summary: {
          ...baseSalesSummary,
          revenue,
          grossProfit,
          netProfit,
          purchaseCost,
          expenses,
        },
        salesTrend,
        topSellingProducts,
        categoryWiseSales,
        dailySalesCount,
        recentSales,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== REVENUE ANALYTICS ====================

export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly', customStartDate, customEndDate } = req.query;

    const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);
    const groupFormat = getGroupFormat(period);

    // Revenue trend = Sales - Purchase Cost - Expenses
    const revenueTrend = await Sale.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          totalSales: { $sum: '$totalAmount' },
        },
      },
      {
        $lookup: {
          from: 'purchases',
          let: { date: '$_id' },
          pipeline: [
            {
              $match: {
                status: 'completed',
                $expr: {
                  $eq: [
                    { $dateToString: { format: groupFormat, date: '$createdAt' } },
                    '$$date',
                  ],
                },
              },
            },
            { $group: { _id: null, totalPurchase: { $sum: '$totalAmount' } } },
          ],
          as: 'purchases',
        },
      },
      {
        $lookup: {
          from: 'expenses',
          let: { date: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $dateToString: { format: groupFormat, date: '$date' } },
                    '$$date',
                  ],
                },
              },
            },
            { $group: { _id: null, totalExpense: { $sum: '$amount' } } },
          ],
          as: 'expenses',
        },
      },
      {
        $project: {
          _id: 1,
          sales: '$totalSales',
          purchases: { $arrayElemAt: ['$purchases.totalPurchase', 0] },
          expenses: { $arrayElemAt: ['$expenses.totalExpense', 0] },
          revenue: {
            $subtract: [
              '$totalSales',
              {
                $add: [
                  { $ifNull: [{ $arrayElemAt: ['$purchases.totalPurchase', 0] }, 0] },
                  { $ifNull: [{ $arrayElemAt: ['$expenses.totalExpense', 0] }, 0] },
                ],
              },
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Overall revenue summary
    const totalSales = await Sale.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const totalPurchases = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const totalExpensesSum = await Expense.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const sales = totalSales[0]?.total || 0;
    const purchases = totalPurchases[0]?.total || 0;
    const expensesTotal = totalExpensesSum[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSales: sales,
          totalPurchaseCost: purchases,
          totalExpenses: expensesTotal,
          grossProfit: sales - purchases,
          netProfit: sales - purchases - expensesTotal,
          profitMargin: sales > 0 ? (((sales - purchases - expensesTotal) / sales) * 100).toFixed(2) : 0,
        },
        revenueTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PURCHASE ANALYTICS ====================

export const getPurchaseAnalytics = async (req, res, next) => {
  try {
    const {
      period = 'monthly',
      supplier,
      customStartDate,
      customEndDate,
    } = req.query;

    const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);
    const groupFormat = getGroupFormat(period);

    // Purchase trend
    const purchaseTrend = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgPurchaseValue: { $avg: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Purchase summary
    const purchaseSummary = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTax: { $sum: '$taxAmount' },
          avgPurchaseValue: { $avg: '$totalAmount' },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Supplier-wise purchases
    const supplierWisePurchases = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$supplier',
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgValue: { $avg: '$totalAmount' },
        },
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierDetails',
        },
      },
      {
        $project: {
          _id: 1,
          supplierName: { $arrayElemAt: ['$supplierDetails.name', 0] },
          totalPurchases: 1,
          totalAmount: 1,
          avgValue: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Category-wise purchases
    const categoryWisePurchases = await Purchase.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $group: {
          _id: { $arrayElemAt: ['$productDetails.category', 0] },
          totalAmount: { $sum: '$items.total' },
          quantity: { $sum: '$items.quantity' },
          purchases: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryDetails',
        },
      },
      {
        $project: {
          categoryName: { $arrayElemAt: ['$categoryDetails.name', 0] },
          totalAmount: 1,
          quantity: 1,
          purchases: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Recent purchases
    const recentPurchases = await Purchase.find({
      status: 'completed',
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('purchaseNumber supplier totalAmount taxAmount paymentStatus createdAt status')
      .populate('supplier', 'name phone email');

    res.status(200).json({
      success: true,
      data: {
        summary: purchaseSummary[0] || {
          totalPurchases: 0,
          totalAmount: 0,
          totalTax: 0,
          avgPurchaseValue: 0,
          pendingPayments: 0,
        },
        purchaseTrend,
        supplierWisePurchases,
        categoryWisePurchases,
        recentPurchases,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== CASH FLOW ANALYTICS ====================

export const getCashFlowAnalytics = async (req, res, next) => {
  try {
    const { period = 'monthly', customStartDate, customEndDate } = req.query;
    const { startDate, endDate } = getDateRange(period, customStartDate, customEndDate);
    const groupFormat = getGroupFormat(period);

    const [paymentInTrend, paymentOutTrend, expenseTrend] = await Promise.all([
      PaymentIn.aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$date' } },
            totalInflow: { $sum: '$amountReceived' },
            count: { $sum: 1 }
          }
        }
      ]),
      PaymentOut.aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$date' } },
            totalOutflow: { $sum: '$amountPaid' },
            count: { $sum: 1 }
          }
        }
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$date' } },
            totalExpenses: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const allDates = new Set([
      ...paymentInTrend.map(i => i._id),
      ...paymentOutTrend.map(i => i._id),
      ...expenseTrend.map(i => i._id)
    ]);

    const trend = Array.from(allDates).map(date => {
      const inflow = paymentInTrend.find(i => i._id === date)?.totalInflow || 0;
      const outflow = (paymentOutTrend.find(i => i._id === date)?.totalOutflow || 0) + 
                      (expenseTrend.find(i => i._id === date)?.totalExpenses || 0);
      return {
        date,
        inflow,
        outflow,
        net: inflow - outflow
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalInflow: trend.reduce((sum, item) => sum + item.inflow, 0),
          totalOutflow: trend.reduce((sum, item) => sum + item.outflow, 0),
          netCashFlow: trend.reduce((sum, item) => sum + item.net, 0)
        },
        trend
      }
    });
  } catch (error) {
    next(error);
  }
};
