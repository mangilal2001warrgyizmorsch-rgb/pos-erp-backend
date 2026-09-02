import crypto from 'crypto';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';

/**
 * Mock Service to simulate E-Invoice / IRN generation via a sandbox API (e.g. ClearTax/NIC).
 */
export const generateEInvoice = async (saleId) => {
  const sale = await Sale.findById(saleId).populate('customer');
  if (!sale) {
    throw new Error('Sale not found');
  }

  // Business logic for E-Invoice eligibility (usually B2B or > 50,000 INR for eway bill)
  const isB2B = sale.customer && sale.customer.gstNumber;
  const isHighValue = sale.totalAmount >= 50000;

  if (!isB2B && !isHighValue) {
    throw new Error('Invoice is not eligible for E-Invoicing (Must be B2B or > ₹50,000)');
  }

  if (sale.irn) {
    throw new Error('E-Invoice is already generated for this sale');
  }

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Generate a mock 64-character IRN (hash of invoice number + timestamp)
  const hashString = `${sale.invoiceNumber}-${Date.now()}`;
  const mockIrn = crypto.createHash('sha256').update(hashString).digest('hex');

  // Generate a mock signed QR code string
  const qrPayload = JSON.stringify({
    SellerGstin: "29AWGPV7107B1Z1",
    BuyerGstin: sale.customer?.gstNumber || "URP",
    DocNo: sale.invoiceNumber,
    DocTyp: "INV",
    DocDt: sale.createdAt.toISOString().split('T')[0],
    TotVal: sale.totalAmount,
    ItemCnt: sale.items.length,
    MainHsnCode: sale.items[0]?.hsn || "9983",
    Irn: mockIrn,
    IrnDt: new Date().toISOString().split('T')[0]
  });

  // Mocking the Sandbox signature for the QR Code
  const mockQrCode = `mock_signed_${Buffer.from(qrPayload).toString('base64')}`;

  // Mock E-Way Bill if amount > 50000
  let mockEwayBill = null;
  if (isHighValue) {
    mockEwayBill = Math.floor(100000000000 + Math.random() * 900000000000).toString(); // 12 digit
  }

  // Update sale in DB
  sale.irn = mockIrn;
  sale.qrCode = mockQrCode;
  sale.eInvoiceStatus = 'generated';
  if (mockEwayBill) {
    sale.ewayBillNumber = mockEwayBill;
  }

  await sale.save();

  return sale;
};
