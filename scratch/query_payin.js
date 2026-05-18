import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import CashBankTransaction from '../models/CashBankTransaction.js';
import BankAccount from '../models/BankAccount.js'; // Registers BankAccount model

const run = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pos-erp';
    await mongoose.connect(mongoUri);
    console.log('DB connected');

    const accountId = '6a05b86f051fccc095fda3be';
    let query = {};
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      query.accountId = accountId;
    }

    console.log('Query:', query);
    const transactions = await CashBankTransaction.find(query)
      .sort('-date')
      .populate('accountId', 'accountName accountNumber bankName');

    console.log(`Total transactions returned: ${transactions.length}`);
    transactions.forEach(t => {
      console.log(`- ${t.transactionNo} (${t.type}) Amount: ${t.amount} Date: ${t.date.toISOString()} CreatedAt: ${t.createdAt.toISOString()}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
};
run();
