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

export const updateLoan = async (req, res) => {
  try {
    const { loanName, lenderName, totalAmount, interestRate, currentBalance } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    loan.loanName = loanName || loan.loanName;
    loan.lenderName = lenderName || loan.lenderName;
    loan.totalAmount = totalAmount !== undefined ? Number(totalAmount) : loan.totalAmount;
    loan.interestRate = interestRate !== undefined ? Number(interestRate) : loan.interestRate;
    loan.currentBalance = currentBalance !== undefined ? Number(currentBalance) : loan.currentBalance;

    await loan.save();
    res.status(200).json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    await loan.deleteOne();
    res.status(200).json({ success: true, message: 'Loan deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
