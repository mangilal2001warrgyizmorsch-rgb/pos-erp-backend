import nodemailer from 'nodemailer';
import Integration from '../models/Integration.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';

export const sendEmailBill = async (sale, customer) => {
  try {
    if (!customer || !customer.email) {
      console.log('EmailService: No customer or email provided. Skipping.');
      return false;
    }

    const integration = await Integration.findOne();
    if (!integration || !integration.email || !integration.email.isActive) {
      console.log('EmailService: Email integration is disabled or not configured. Skipping.');
      return false;
    }

    const { provider, host, port, user, password, sendgridApiKey } = integration.email;

    let transporter;

    if (provider === 'sendgrid') {
      if (!user || !sendgridApiKey) {
        console.log('EmailService: SendGrid credentials are missing.');
        return false;
      }
      // SendGrid standard SMTP config
      transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey', // This is exactly the string 'apikey' for SendGrid
          pass: sendgridApiKey,
        },
      });
    } else {
      // Custom SMTP
      if (!host || !port || !user || !password) {
        console.log('EmailService: SMTP credentials are missing.');
        return false;
      }

      // Clean the host in case user accidentally entered https://
      let cleanedHost = host.replace(/^https?:\/\//, '');
      if (cleanedHost.endsWith('/')) {
        cleanedHost = cleanedHost.slice(0, -1);
      }

      transporter = nodemailer.createTransport({
        host: cleanedHost,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass: password,
        },
      });
    }

    const business = await BusinessProfile.findOne();
    const businessName = business?.businessName || 'Our Store';

    console.log('Generating PDF Invoice for Email attachment...');
    const pdfBuffer = await generateInvoicePDF(sale, business, customer);

    const mailOptions = {
      from: `"${businessName}" <${user}>`,
      to: customer.email,
      subject: `Invoice #${sale.invoiceNumber} from ${businessName}`,
      text: `Hello ${customer.name},\n\nThank you for shopping with ${businessName}. Please find attached your invoice #${sale.invoiceNumber} for ₹${sale.totalAmount.toFixed(2)}.\n\nRegards,\n${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Thank you for your business!</h2>
          <p>Hello <strong>${customer.name}</strong>,</p>
          <p>Thank you for shopping with <strong>${businessName}</strong>. Please find attached your invoice <strong>#${sale.invoiceNumber}</strong> for the amount of <strong>₹${sale.totalAmount.toFixed(2)}</strong>.</p>
          <p>If you have any questions, feel free to reply to this email.</p>
          <br/>
          <p>Best regards,<br/><strong>${businessName}</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `Invoice-${sale.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${customer.email}. MessageId: ${info.messageId}`);
    return true;

  } catch (error) {
    console.error('EmailService Error:', error);
    return false;
  }
};
