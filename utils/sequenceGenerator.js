import Counter from '../models/Counter.js';

/**
 * Generates an atomic sequential number for given prefix (e.g. INV, PUR)
 * Format: PREFIX-YYMM-XXXXX (e.g. INV-2605-00001)
 */
export const generateSequenceNumber = async (prefix, session = null) => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const sequenceId = `${prefix}-${year}${month}`;

  // Use findOneAndUpdate to atomically increment the counter
  const counter = await Counter.findByIdAndUpdate(
    sequenceId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return `${sequenceId}-${counter.seq.toString().padStart(5, '0')}`;
};
