import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import CampaignLog from "../models/CampaignLog.js";
import { sendWhatsAppBill } from "../services/whatsappService.js";

const redisConnection = new IORedis({
  maxRetriesPerRequest: null,
});

export const marketingQueue = new Queue("marketing-queue", {
  connection: redisConnection,
});

const worker = new Worker(
  "marketing-queue",
  async (job) => {
    const { campaignId, customerId, phone, messageTemplate, mediaUrl } = job.data;
    
    try {
      // In a real scenario, we'd use a generic sendWhatsAppMessage function.
      // Since sendWhatsAppBill exists, we'll try to adapt or we assume a generic send function.
      // For now, let's pretend we are sending a free-form message.
      // If we had a template, we'd send template details.
      
      console.log(`[MarketingQueue] Sending message to ${phone}`);
      
      // Update log to 'sent'
      await CampaignLog.findOneAndUpdate(
        { campaignId, customerId },
        { status: "sent" }
      );
      
      // Artificial delay to simulate rate limiting (1 sec per message)
      await new Promise((res) => setTimeout(res, 1000));
      
      // Here you would call kapso.messages.sendText or Twilio API
      // Since we don't have templates, we just simulate success for now
      
      await CampaignLog.findOneAndUpdate(
        { campaignId, customerId },
        { status: "delivered" }
      );
      
      return { success: true, phone };
    } catch (error) {
      console.error(`[MarketingQueue] Failed to send message to ${phone}:`, error);
      await CampaignLog.findOneAndUpdate(
        { campaignId, customerId },
        { status: "failed", errorMessage: error.message }
      );
      throw error;
    }
  },
  { 
    connection: redisConnection,
    limiter: {
      max: 5, // 5 messages
      duration: 1000 // per 1 second
    }
  }
);

worker.on("completed", (job) => {
  console.log(`[MarketingQueue] Job ${job.id} completed!`);
});

worker.on("failed", (job, err) => {
  console.log(`[MarketingQueue] Job ${job.id} failed with ${err.message}`);
});
