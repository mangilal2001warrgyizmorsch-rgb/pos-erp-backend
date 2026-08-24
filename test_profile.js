import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const BusinessProfile = mongoose.connection.collection('businessprofiles');
  const doc = await BusinessProfile.findOne({});
  console.log("Logo:", doc?.logo);
  console.log("Signature:", doc?.signature);
  process.exit(0);
});
