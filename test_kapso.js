import mongoose from 'mongoose';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Integration = mongoose.connection.collection('integrations');
  const doc = await Integration.findOne({});
  
  if (!doc || !doc.whatsapp || !doc.whatsapp.kapsoApiKey) {
    console.error("Error: kapsoApiKey is not set in the database.");
    console.log("Please save it via the POS Integrations UI first.");
    process.exit(1);
  }

  const { kapsoApiKey } = doc.whatsapp;
  const phoneNumberId = "597907523413541"; 
  const toPhone = "917239849705";

  console.log(`Sending Kapso message from Phone ID ${phoneNumberId} to ${toPhone}...`);

  const client = new WhatsAppClient({
    baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    kapsoApiKey: kapsoApiKey.trim()
  });

  try {
    const response = await client.messages.sendText({ 
      phoneNumberId, 
      to: toPhone, 
      body: "Hello from Kapso SDK! Your POS integration is working natively from the database." 
    });
    console.log("Success! Message sent:", response);
  } catch (error) {
    console.error("Failed to send message:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
  process.exit(0);
});
