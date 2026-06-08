import AccountGroup from "../../models/accounting/AccountGroup.model.js";

export const createAccountGroup = async (req, res) => {
  try {
    const accountGroup = await AccountGroup.create({
      ...req.body,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: accountGroup });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAccountGroups = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }
    if (req.query.nature) {
      filter.nature = String(req.query.nature).toUpperCase();
    }

    const accountGroups = await AccountGroup.find(filter)
      .populate("parentGroupId", "name code")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: accountGroups.length,
      data: accountGroups,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAccountGroupById = async (req, res) => {
  try {
    const accountGroup = await AccountGroup.findById(req.params.id).populate(
      "parentGroupId",
      "name code",
    );

    if (!accountGroup) {
      return res.status(404).json({ success: false, message: "Account group not found" });
    }

    return res.status(200).json({ success: true, data: accountGroup });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAccountGroup = async (req, res) => {
  try {
    const accountGroup = await AccountGroup.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!accountGroup) {
      return res.status(404).json({ success: false, message: "Account group not found" });
    }

    return res.status(200).json({ success: true, data: accountGroup });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAccountGroup = async (req, res) => {
  try {
    const accountGroup = await AccountGroup.findById(req.params.id);
    if (!accountGroup) {
      return res.status(404).json({ success: false, message: "Account group not found" });
    }

    if (accountGroup.isSystemDefault) {
      accountGroup.isActive = false;
      await accountGroup.save();
      return res.status(200).json({ success: true, data: accountGroup });
    }

    await AccountGroup.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Account group deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
