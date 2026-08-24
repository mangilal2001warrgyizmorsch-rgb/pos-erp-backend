import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import twilio from 'twilio';
import Integration from '../models/Integration.js';
import BusinessProfile from '../models/BusinessProfile.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';

/**
 * Format phone number to E.164 format (required by Twilio)
 * Assumes Indian numbers (+91) if 10 digits are provided without country code.
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length > 10 && !phone.startsWith('+')) {
    return `+${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

/**
 * Send WhatsApp Bill to Customer
 * @param {Object} sale - The sale document
 * @param {Object} customer - The customer document
 */
export const sendWhatsAppBill = async (sale, customer) => {
  try {
    if (!customer || !customer.phone) {
      console.log('WhatsApp: No customer or phone number provided. Skipping.');
      return false;
    }

    const integration = await Integration.findOne();
    if (!integration || !integration.whatsapp || !integration.whatsapp.isActive) {
      console.log('WhatsApp: Integration is disabled or not configured. Skipping.');
      return false;
    }

    const { provider, twilioSid, twilioAuthToken, twilioNumber, twilioContentSid } = integration.whatsapp;

    // Fetch business profile for the message header
    const business = await BusinessProfile.findOne();
    const businessName = business?.businessName || 'Our Store';

    // Construct the message
    const itemsList = sale.items.map(item => `- ${item.name || item.itemName} (x${item.quantity})`).join('\n');
    const messageBody = `Hello ${customer.name},

Thank you for shopping with *${businessName}*!

*Bill Details:*
Invoice: #${sale.invoiceNumber}
Total Amount: ₹${sale.totalAmount.toFixed(2)}

*Items:*
${itemsList}

We hope to see you again soon!`;

    if (provider === 'kapso') {
      const { kapsoApiKey, kapsoPhoneNumberId } = integration.whatsapp;
      if (!kapsoApiKey || !kapsoPhoneNumberId) {
        console.log('WhatsApp: Kapso credentials are missing.');
        return false;
      }
      
      const kapsoClient = new WhatsAppClient({
        baseUrl: 'https://api.kapso.ai/meta/whatsapp',
        kapsoApiKey: kapsoApiKey.trim()
      });

      const toPhone = formatPhoneNumber(customer.phone);
      if (!toPhone) return false;
      // Kapso SDK usually expects the number without the '+' symbol
      const kapsoToPhone = toPhone.replace('+', '');

      // Generate the PDF invoice
      console.log('Generating PDF Invoice for Kapso upload...');
      const pdfBuffer = await generateInvoicePDF(sale, business, customer);

      // Upload PDF to Meta/Kapso
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const uploadResponse = await kapsoClient.media.upload({
        phoneNumberId: kapsoPhoneNumberId.trim(),
        type: 'application/pdf',
        file: pdfBlob,
        fileName: `Invoice-${sale.invoiceNumber}.pdf`
      });

      // Send the document message
      await kapsoClient.messages.sendDocument({ 
        phoneNumberId: kapsoPhoneNumberId.trim(), 
        to: kapsoToPhone, 
        document: {
          id: uploadResponse.id,
          caption: messageBody,
          filename: `Invoice-${sale.invoiceNumber}.pdf`
        }
      });

      console.log(`WhatsApp message sent successfully via Kapso to ${toPhone}`);
      return true;
    }

    if (provider !== 'twilio') {
      console.log(`WhatsApp: Provider ${provider} is not supported yet.`);
      return false;
    }

    if (!twilioSid || !twilioAuthToken || !twilioNumber) {
      console.log('WhatsApp: Twilio credentials are missing.');
      return false;
    }

    const client = twilio(twilioSid.trim(), twilioAuthToken.trim());
    const toPhone = formatPhoneNumber(customer.phone);
    
    // Clean the Twilio number (e.g., if user inputs "1 (737) 250-8034")
    const cleanedTwilioNumber = twilioNumber.replace(/\D/g, '');
    const fromPhone = `whatsapp:+${cleanedTwilioNumber}`;

    if (!toPhone) return false;
    const messagePayload = {
      from: fromPhone,
      to: `whatsapp:${toPhone}`
    };

    if (twilioContentSid && twilioContentSid.trim()) {
      messagePayload.contentSid = twilioContentSid.trim();
      messagePayload.contentVariables = JSON.stringify({
        "1": customer.name,
        "2": businessName,
        "3": sale.invoiceNumber,
        "4": sale.totalAmount.toFixed(2)
      });
    } else {
      messagePayload.body = messageBody;
    }

    const message = await client.messages.create(messagePayload);

    console.log(`WhatsApp message sent successfully to ${toPhone}. SID: ${message.sid}`);
    return true;

  } catch (error) {
    console.error('WhatsApp Service Error:', error);
    return false;
  }
};
