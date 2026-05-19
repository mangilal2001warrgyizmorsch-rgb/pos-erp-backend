import Cheque from '../models/Cheque.js';
import { createCashBankTransaction, reverseReferenceTransaction } from '../services/cashBankTransactionService.js';

export const createCheque = async (req, res) => {
  try {
    const { type, chequeNumber, amount, date, partyName, bankName, status, clearanceAccountType, clearanceAccountId } = req.body;
    
    const cheque = await Cheque.create({
      type,
      chequeNumber,
      amount: Number(amount),
      date,
      partyName,
      bankName,
      status: status || 'Pending',
      clearanceAccountType,
      clearanceAccountId: (clearanceAccountId && clearanceAccountId !== "") ? clearanceAccountId : undefined
    });

    if (cheque.status === 'Cleared') {
      const direction = cheque.type === 'received' ? 'in' : 'out';
      const description = cheque.type === 'received'
        ? `Cheque cleared: ${cheque.chequeNumber} from ${cheque.partyName}`
        : `Cheque cleared: ${cheque.chequeNumber} to ${cheque.partyName}`;

      const tx = await createCashBankTransaction({
        date: cheque.date || new Date(),
        type: 'cheque_clearance',
        direction,
        amount: cheque.amount,
        paymentMode: 'Cheque',
        accountType: cheque.clearanceAccountType || 'bank',
        accountId: cheque.clearanceAccountId || undefined,
        description,
        referenceModule: 'cheque',
        referenceId: cheque._id,
        referenceNo: cheque.chequeNumber,
        createdBy: req.user?._id
      });

      if (tx) {
        cheque.clearanceTransactionId = tx._id;
        await cheque.save();
      }
    }

    res.status(201).json({ success: true, data: cheque });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCheques = async (req, res) => {
  try {
    const cheques = await Cheque.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, count: cheques.length, data: cheques });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCheque = async (req, res) => {
  try {
    const { type, chequeNumber, amount, date, partyName, bankName, status, clearanceAccountType, clearanceAccountId } = req.body;
    const cheque = await Cheque.findById(req.params.id);
    if (!cheque) {
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }

    // If cheque was already cleared, reverse it first to reset balance
    if (cheque.status === 'Cleared') {
      await reverseReferenceTransaction('cheque', cheque._id, req.user?._id, 'Cheque update adjustment');
      cheque.clearanceTransactionId = undefined;
    }

    cheque.type = type || cheque.type;
    cheque.chequeNumber = chequeNumber || cheque.chequeNumber;
    cheque.amount = amount !== undefined ? Number(amount) : cheque.amount;
    cheque.date = date || cheque.date;
    cheque.partyName = partyName || cheque.partyName;
    cheque.bankName = bankName !== undefined ? bankName : cheque.bankName;
    cheque.status = status || cheque.status;
    cheque.clearanceAccountType = clearanceAccountType !== undefined ? clearanceAccountType : cheque.clearanceAccountType;
    cheque.clearanceAccountId = (clearanceAccountId && clearanceAccountId !== "") ? clearanceAccountId : undefined;

    // If new status is Cleared, create new cash/bank transaction
    if (cheque.status === 'Cleared') {
      const direction = cheque.type === 'received' ? 'in' : 'out';
      const description = cheque.type === 'received'
        ? `Cheque cleared: ${cheque.chequeNumber} from ${cheque.partyName}`
        : `Cheque cleared: ${cheque.chequeNumber} to ${cheque.partyName}`;

      const tx = await createCashBankTransaction({
        date: cheque.date || new Date(),
        type: 'cheque_clearance',
        direction,
        amount: cheque.amount,
        paymentMode: 'Cheque',
        accountType: cheque.clearanceAccountType || 'bank',
        accountId: cheque.clearanceAccountId || undefined,
        description,
        referenceModule: 'cheque',
        referenceId: cheque._id,
        referenceNo: cheque.chequeNumber,
        createdBy: req.user?._id
      });

      if (tx) {
        cheque.clearanceTransactionId = tx._id;
      }
    } else {
      // If no longer cleared, reset clearance fields
      cheque.clearanceAccountType = undefined;
      cheque.clearanceAccountId = undefined;
    }

    await cheque.save();
    res.status(200).json({ success: true, data: cheque });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCheque = async (req, res) => {
  try {
    const cheque = await Cheque.findById(req.params.id);
    if (!cheque) {
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }

    // Reverse if it was cleared
    if (cheque.status === 'Cleared') {
      await reverseReferenceTransaction('cheque', cheque._id, req.user?._id, 'Cheque entry deleted');
    }

    await cheque.deleteOne();
    res.status(200).json({ success: true, message: 'Cheque deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
