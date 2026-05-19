import Cheque from '../models/Cheque.js';

export const createCheque = async (req, res) => {
  try {
    const { type, chequeNumber, amount, date, partyName, bankName } = req.body;
    
    const cheque = await Cheque.create({
      type,
      chequeNumber,
      amount: Number(amount),
      date,
      partyName,
      bankName
    });

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
    const { type, chequeNumber, amount, date, partyName, bankName, status } = req.body;
    const cheque = await Cheque.findById(req.params.id);
    if (!cheque) {
      return res.status(404).json({ success: false, message: 'Cheque not found' });
    }

    cheque.type = type || cheque.type;
    cheque.chequeNumber = chequeNumber || cheque.chequeNumber;
    cheque.amount = amount !== undefined ? Number(amount) : cheque.amount;
    cheque.date = date || cheque.date;
    cheque.partyName = partyName || cheque.partyName;
    cheque.bankName = bankName !== undefined ? bankName : cheque.bankName;
    cheque.status = status || cheque.status;

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

    await cheque.deleteOne();
    res.status(200).json({ success: true, message: 'Cheque deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
