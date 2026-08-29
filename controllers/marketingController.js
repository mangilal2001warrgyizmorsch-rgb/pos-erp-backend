import Campaign from "../models/Campaign.js";
import CampaignLog from "../models/CampaignLog.js";
import Customer from "../models/Customer.js";
import { marketingQueue } from "../utils/marketingQueue.js";

export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCampaignLogs = async (req, res) => {
  try {
    const logs = await CampaignLog.find({ campaignId: req.params.id })
      .populate("customerId", "name phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCampaign = async (req, res) => {
  try {
    const { name, messageTemplate, mediaUrl, targetAudience } = req.body;
    
    // 1. Fetch audience
    let customers = [];
    if (targetAudience === "all_customers") {
      customers = await Customer.find({ isActive: true });
    } else if (targetAudience === "top_spenders") {
      customers = await Customer.find({ isActive: true, totalSpent: { $gt: 10000 } });
    } else {
      customers = await Customer.find({ isActive: true }).limit(5); // Default to a few for testing
    }
    
    // Filter customers with valid phone numbers
    const validCustomers = customers.filter(c => c.phone && c.phone.length >= 10);
    
    // 2. Create Campaign
    const campaign = new Campaign({
      name,
      messageTemplate,
      mediaUrl,
      targetAudience,
      status: "processing",
      totalRecipients: validCustomers.length,
    });
    await campaign.save();
    
    // 3. Add to Queue & Create Logs
    const jobs = [];
    const logs = [];
    
    for (const customer of validCustomers) {
      logs.push({
        campaignId: campaign._id,
        customerId: customer._id,
        phone: customer.phone,
        status: "pending"
      });
      
      jobs.push({
        name: "send-message",
        data: {
          campaignId: campaign._id,
          customerId: customer._id,
          phone: customer.phone,
          messageTemplate,
          mediaUrl
        }
      });
    }
    
    if (logs.length > 0) {
      await CampaignLog.insertMany(logs);
      await marketingQueue.addBulk(jobs);
    } else {
      campaign.status = "completed";
      await campaign.save();
    }
    
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
