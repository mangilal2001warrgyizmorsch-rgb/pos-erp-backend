import BusinessProfile from "../models/BusinessProfile.js";

// Get Business Profile (Single record)
export const getProfile = async (req, res) => {
  try {
    let profile = await BusinessProfile.findOne();
    
    // If no profile exists, return a default object so the frontend doesn't break
    if (!profile) {
      return res.status(200).json({
        success: true,
        data: {
          businessName: "My Professional POS",
          tagline: "Quality & Trust",
          address: "Enter Business Address",
          phone: "0000000000",
          email: "admin@example.com",
          gstin: "",
          logoText: "MP",
        }
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Business Profile
export const updateProfile = async (req, res) => {
  try {
    console.log("Updating business profile with data:", req.body);
    let profile = await BusinessProfile.findOne();

    if (profile) {
      profile = await BusinessProfile.findByIdAndUpdate(profile._id, req.body, {
        new: true,
        runValidators: true,
      });
    } else {
      profile = await BusinessProfile.create(req.body);
    }

    console.log("Profile updated successfully");
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error updating business profile:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
