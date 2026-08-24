import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Integration = mongoose.connection.collection('integrations');
  const doc = await Integration.findOne({});
  const kapsoApiKey = doc.whatsapp.kapsoApiKey;

  const client = new WhatsAppClient({
    baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    kapsoApiKey: kapsoApiKey.trim()
  });

  const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const pdfBlob = new Blob([dummyPdf], { type: 'application/pdf' });

  try {
    const res = await client.media.upload({
      phoneNumberId: '597907523413541',
      type: 'application/pdf',
      file: pdfBlob,
      fileName: 'test.pdf'
    });
    console.log("Success!", res);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
  process.exit(0);
});
