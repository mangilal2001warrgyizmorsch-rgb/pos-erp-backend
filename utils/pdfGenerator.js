import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Helper to get local file path from URL
const getLocalImagePath = (url) => {
  if (!url) return null;
  const match = url.match(/\/uploads\/(.*)/);
  if (match) {
    const filePath = path.join(process.cwd(), 'uploads', match[1]);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
};

/**
 * Helper to generate a PDF invoice in-memory and return a Buffer.
 * @param {Object} sale - The sale document
 * @param {Object} business - The business profile document
 * @param {Object} customer - The customer document
 * @returns {Promise<Buffer>}
 */
export const generateInvoicePDF = (sale, business, customer) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Register Fonts for Rupee symbol support
      const fontRegular = path.join(process.cwd(), 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf');
      const fontBold = path.join(process.cwd(), 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf');
      doc.registerFont('Roboto', fontRegular);
      doc.registerFont('Roboto-Bold', fontBold);

      const primaryColor = '#4f46e5'; // Indigo-600
      const textColor = '#1f2937'; // Gray-800
      const lightGray = '#f3f4f6'; // Gray-100
      const darkGray = '#6b7280'; // Gray-500
      const borderGreen = '#047857'; // Emerald-700

      // Helper function for drawing lines
      const drawLine = (y, color = borderGreen) => {
        doc.strokeColor(color).lineWidth(1.5)
           .moveTo(50, y).lineTo(545, y).stroke();
      };

      let currentY = 50;
      let textStartX = 50;

      // Handle Logo
      const logoPath = getLocalImagePath(business?.logo);
      if (logoPath) {
        doc.image(logoPath, 50, 45, { height: 50 });
        textStartX = 120; // Shift text to the right if logo exists
      }

      // Header - Business Info
      doc.font('Roboto-Bold').fontSize(22).fillColor(primaryColor)
         .text(business?.businessName || 'Our Store', textStartX, 50);
      
      doc.font('Roboto').fontSize(10).fillColor(darkGray)
         .text(business?.address || 'Business Address', textStartX, 75);
      
      const gstinText = business?.gstin ? ` | GSTIN: ${business.gstin}` : '';
      doc.text(`${business?.phone || ''}${gstinText}`, textStartX, 90);

      // Header - Invoice Info
      // Tax Invoice Badge
      doc.rect(430, 45, 115, 20).fillAndStroke(primaryColor, primaryColor);
      doc.font('Roboto-Bold').fontSize(10).fillColor('#ffffff')
         .text('TAX INVOICE', 430, 51, { width: 115, align: 'center' });
      
      doc.font('Roboto-Bold').fontSize(14).fillColor(textColor)
         .text(`${sale.invoiceNumber}`, 400, 75, { width: 145, align: 'right' });
      
      const saleDate = new Date(sale.createdAt || Date.now()).toLocaleDateString('en-GB');
      doc.font('Roboto').fontSize(10).fillColor(darkGray)
         .text(saleDate, 400, 95, { width: 145, align: 'right' });

      // Separator Line
      drawLine(125);

      // Bill To & Payment Details (Gray Box)
      doc.roundedRect(50, 140, 495, 80, 5).fill(lightGray);

      // Bill To
      doc.font('Roboto-Bold').fontSize(9).fillColor(darkGray)
         .text('BILL TO', 65, 155);
      doc.font('Roboto-Bold').fontSize(12).fillColor(textColor)
         .text(customer?.name || sale.customerName || 'Walk-in Customer', 65, 170);
      doc.font('Roboto').fontSize(11).fillColor(textColor)
         .text(customer?.phone || '', 65, 185);

      // Payment Details
      doc.font('Roboto-Bold').fontSize(9).fillColor(darkGray)
         .text('PAYMENT DETAILS', 300, 155);
      doc.font('Roboto').fontSize(11).fillColor(textColor)
         .text('Payment Mode: ', 300, 170, { continued: true })
         .font('Roboto-Bold').text((sale.paymentMethod || 'CASH').toUpperCase());
      doc.font('Roboto').fontSize(11).fillColor(textColor)
         .text('Status: ', 300, 185, { continued: true })
         .font('Roboto-Bold').text((sale.paymentStatus || 'PAID').toUpperCase());
      doc.font('Roboto').fontSize(11).fillColor(textColor)
         .text('Amount Paid: ', 300, 200, { continued: true })
         .font('Roboto-Bold').text(`₹${(sale.amountPaid || sale.totalAmount).toFixed(2)}`);

      // Table Header
      const tableTop = 240;
      doc.rect(50, tableTop, 495, 25).fill(primaryColor);
      doc.font('Roboto-Bold').fontSize(10).fillColor('#ffffff');
      doc.text('#', 60, tableTop + 7);
      doc.text('Item / SKU', 90, tableTop + 7);
      doc.text('Qty', 290, tableTop + 7, { width: 40, align: 'right' });
      doc.text('Rate', 340, tableTop + 7, { width: 70, align: 'right' });
      doc.text('Tax', 415, tableTop + 7, { width: 35, align: 'right' });
      doc.text('Amount', 455, tableTop + 7, { width: 85, align: 'right' });

      // Table Rows
      let y = tableTop + 35;
      doc.font('Roboto').fontSize(10).fillColor(textColor);

      sale.items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const itemName = item.name || item.itemName || 'Item';
        const rate = (item.unitPrice || 0).toFixed(2);
        const taxRate = item.taxRate || 0;
        const total = (item.total || 0).toFixed(2);

        doc.font('Roboto').fillColor(textColor);
        doc.text((index + 1).toString(), 60, y);
        doc.font('Roboto-Bold').text(itemName, 90, y, { width: 190 });
        doc.font('Roboto').text(item.quantity.toString(), 290, y, { width: 40, align: 'right' });
        doc.text(`₹${rate}`, 340, y, { width: 70, align: 'right' });
        doc.text(`${taxRate}%`, 415, y, { width: 35, align: 'right' });
        doc.font('Roboto-Bold').text(`₹${total}`, 455, y, { width: 85, align: 'right' });

        y += 15;
        if (item.description || item.sku) {
          doc.font('Roboto').fontSize(9).fillColor(darkGray);
          if (item.description) {
            doc.text(item.description, 90, y, { width: 190 });
            y += 12;
          }
          if (item.sku) {
            doc.text(item.sku, 90, y, { width: 190 });
            y += 12;
          }
        }
        y += 10;
        doc.strokeColor(lightGray).lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
      });

      // Totals
      const totalsY = Math.max(y + 20, doc.y + 20);
      
      doc.font('Roboto').fontSize(11).fillColor(textColor);
      doc.text('Subtotal', 380, totalsY);
      doc.text(`₹${(sale.subtotal || sale.totalAmount).toFixed(2)}`, 450, totalsY, { width: 90, align: 'right' });
      
      doc.text('Tax', 380, totalsY + 20);
      doc.text(`₹${(sale.taxAmount || 0).toFixed(2)}`, 450, totalsY + 20, { width: 90, align: 'right' });

      // Grand Total Box
      doc.rect(370, totalsY + 45, 175, 30).fillAndStroke(primaryColor, primaryColor);
      doc.font('Roboto-Bold').fontSize(12).fillColor('#ffffff');
      doc.text('Grand Total', 380, totalsY + 54);
      doc.text(`₹${(sale.totalAmount || 0).toFixed(2)}`, 450, totalsY + 54, { width: 90, align: 'right' });

      // Footer
      const footerY = 700; // Fixed near bottom
      drawLine(footerY - 15);
      
      doc.font('Roboto-Bold').fontSize(10).fillColor(textColor);
      doc.text('TERMS & CONDITIONS', 50, footerY);
      doc.font('Roboto').fontSize(9).fillColor(darkGray);
      doc.text('Goods sold are subject to applicable terms and taxes.', 50, footerY + 15);
      doc.text('Thank you for your business.', 50, footerY + 27);

      // Handle Signature
      const sigPath = getLocalImagePath(business?.signature);
      if (sigPath) {
        doc.image(sigPath, 422, footerY - 15, { height: 40, width: 100, fit: [100, 40], align: 'center' });
      }

      doc.strokeColor(darkGray).lineWidth(1).moveTo(400, footerY + 20).lineTo(545, footerY + 20).stroke();
      doc.font('Roboto-Bold').fontSize(9).fillColor(textColor);
      doc.text('Authorized Signatory', 400, footerY + 25, { width: 145, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
