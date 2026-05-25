import Shift from '../models/Shift.js';
import Sale from '../models/Sale.js';

// @desc    Open a new shift
// @route   POST /api/shifts/open
export const openShift = async (req, res, next) => {
  try {
    const { openingCash, cashierName, counter, notes } = req.body;
    const normalizedCashierName = String(cashierName || '').trim();
    const openingAmount = Number(openingCash || 0);

    if (openingAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Opening cash cannot be negative',
      });
    }

    if (!normalizedCashierName) {
      return res.status(400).json({
        success: false,
        message: 'Cashier name is required',
      });
    }

    // Check if there is already an open shift for this user
    const existingShift = await Shift.findOne({
      cashier: req.user._id,
      status: 'open',
    });

    if (existingShift) {
      return res.status(400).json({
        success: false,
        message: 'You already have an open shift. Please close it first.',
      });
    }

    const shift = await Shift.create({
      cashier: req.user._id,
      cashierName: normalizedCashierName,
      openingCash: openingAmount,
      counter: counter || 'Main Counter',
      notes,
    });

    res.status(201).json({
      success: true,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current open shift
// @route   GET /api/shifts/current
export const getCurrentShift = async (req, res, next) => {
  try {
    const shift = await Shift.findOne({
      cashier: req.user._id,
      status: 'open',
    });

    if (!shift) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    // Recalculate totals from sales during this shift
    const sales = await Sale.find({
      cashier: req.user._id,
      createdAt: { $gte: shift.openingTime },
      status: 'completed',
    });

    let totalSales = 0;
    let totalSalesCash = 0;
    let totalSalesCard = 0;
    let totalSalesUpi = 0;

    sales.forEach(sale => {
      totalSales += sale.totalAmount;
      if (sale.paymentMethod === 'cash') totalSalesCash += sale.totalAmount;
      else if (sale.paymentMethod === 'card') totalSalesCard += sale.totalAmount;
      else if (sale.paymentMethod === 'upi') totalSalesUpi += sale.totalAmount;
    });

    shift.totalSales = totalSales;
    shift.totalSalesCash = totalSalesCash;
    shift.totalSalesCard = totalSalesCard;
    shift.totalSalesUpi = totalSalesUpi;
    shift.expectedCash = shift.openingCash + totalSalesCash + (shift.cashIn || 0) - (shift.cashOut || 0);

    res.status(200).json({
      success: true,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Close shift
// @route   PUT /api/shifts/close
export const closeShift = async (req, res, next) => {
  try {
    const { closingCash, notes } = req.body;
    const closingAmount = Number(closingCash);

    if (!Number.isFinite(closingAmount) || closingAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter valid closing cash',
      });
    }

    const shift = await Shift.findOne({
      cashier: req.user._id,
      status: 'open',
    });

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'No open shift found to close.',
      });
    }

    // Final calculations
    const sales = await Sale.find({
      cashier: req.user._id,
      createdAt: { $gte: shift.openingTime },
      status: 'completed',
    });

    let totalSales = 0;
    let totalSalesCash = 0;
    let totalSalesCard = 0;
    let totalSalesUpi = 0;
    sales.forEach(sale => {
      totalSales += sale.totalAmount;
      if (sale.paymentMethod === 'cash') totalSalesCash += sale.totalAmount;
      else if (sale.paymentMethod === 'card') totalSalesCard += sale.totalAmount;
      else if (sale.paymentMethod === 'upi') totalSalesUpi += sale.totalAmount;
    });

    shift.closingTime = new Date();
    shift.closingCash = closingAmount;
    shift.actualCash = closingAmount;
    shift.totalSales = totalSales;
    shift.totalSalesCash = totalSalesCash;
    shift.totalSalesCard = totalSalesCard;
    shift.totalSalesUpi = totalSalesUpi;
    shift.expectedCash = shift.openingCash + totalSalesCash + (shift.cashIn || 0) - (shift.cashOut || 0);
    shift.difference = closingAmount - shift.expectedCash;
    shift.status = 'closed';
    shift.notes = notes || shift.notes;

    await shift.save();

    res.status(200).json({
      success: true,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};
