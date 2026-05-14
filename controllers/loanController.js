import Loan from '../models/Loan.js';

export const createLoan = async (req, res) => {
  try {
    const { loanName, lenderName, totalAmount, interestRate } = req.body;
    
    const loan = await Loan.create({
      loanName,
      lenderName,
      totalAmount: Number(totalAmount),
      interestRate: Number(interestRate),
      currentBalance: Number(totalAmount)
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLoans = async (req, res) => {
  try {
    const loans = await Loan.find();
    res.status(200).json({ success: true, count: loans.length, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
