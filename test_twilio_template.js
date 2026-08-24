import mongoose from 'mongoose';
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Integration = mongoose.connection.collection('integrations');
  const doc = await Integration.findOne({});
  const { twilioSid, twilioAuthToken, twilioNumber } = doc.whatsapp;
  
  const client = twilio(twilioSid.trim(), twilioAuthToken.trim());
  const fromPhone = `whatsapp:+${twilioNumber.replace(/\D/g, '')}`;
  const toPhone = 'whatsapp:+917239849705';

  console.log(`Sending template from ${fromPhone} to ${toPhone}`);

  try {
    const msg = await client.messages.create({
      body: 'Your POS ERP order of iPhone 17 Pro Max has shipped and should be delivered on 25 Aug 2026. Details: Invoice #INV-12345',
      from: fromPhone,
      to: toPhone
    });
    console.log('Success!', msg.sid);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
});
