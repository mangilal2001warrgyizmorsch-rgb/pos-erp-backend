import PartyLedger from '../models/PartyLedger.js';

// @desc    Get ledger for a specific party (Customer/Supplier)
// @route   GET /api/ledger/:partyId
// @access  Private
export const getLedger = async (req, res) => {
  try {
    const { partyId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;
    
    let query = { partyId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const ledger = await PartyLedger.find(query)
      .sort({ date: 1, createdAt: 1 }) // Chronological order
      .limit(Number(limit));

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
