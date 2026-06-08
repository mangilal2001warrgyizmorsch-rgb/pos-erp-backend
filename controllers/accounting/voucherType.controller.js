import VoucherType from "../../models/accounting/VoucherType.model.js";

export const createVoucherType = async (req, res) => {
  try {
    const voucherType = await VoucherType.create(req.body);
    res.status(201).json({ success: true, data: voucherType });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVoucherTypes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true";
    }

    const voucherTypes = await VoucherType.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, count: voucherTypes.length, data: voucherTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getVoucherType = async (req, res) => {
  try {
    const voucherType = await VoucherType.findById(req.params.id);
    if (!voucherType) {
      return res.status(404).json({ success: false, message: "Voucher type not found" });
    }

    return res.status(200).json({ success: true, data: voucherType });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVoucherType = async (req, res) => {
  try {
    const voucherType = await VoucherType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!voucherType) {
      return res.status(404).json({ success: false, message: "Voucher type not found" });
    }

    return res.status(200).json({ success: true, data: voucherType });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteVoucherType = async (req, res) => {
  try {
    const voucherType = await VoucherType.findById(req.params.id);
    if (!voucherType) {
      return res.status(404).json({ success: false, message: "Voucher type not found" });
    }

    if (voucherType.isSystemDefault) {
      voucherType.isActive = false;
      await voucherType.save();
      return res.status(200).json({ success: true, data: voucherType });
    }

    await VoucherType.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Voucher type deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
