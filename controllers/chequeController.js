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
    const cheques = await Cheque.find().sort('-date');
    res.status(200).json({ success: true, count: cheques.length, data: cheques });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
