import User from '../models/User.js';
import Role from '../models/Role.js';
import RefreshToken from '../models/RefreshToken.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const generateTokens = async (user, res) => {
  const accessToken = user.generateToken(); // This should now have a short expiry, e.g., 15m in .env
  
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshToken.create({
    token: refreshTokenString,
    user: user._id,
    expiresAt,
  });

  // Set HTTP-Only cookie for refresh token
  res.cookie('refreshToken', refreshTokenString, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return accessToken;
};

// @desc    Register user
// @route   POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Get default role permissions
    let defaultPermissions = [];
    const roleDoc = await Role.findOne({ name: role || 'cashier' });
    if (roleDoc) {
      defaultPermissions = roleDoc.permissions;
    }

    const user = await User.create({ name, email, password, role, phone, permissions: defaultPermissions });
    const accessToken = await generateTokens(user, res);

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.',
      });
    }

    const accessToken = await generateTokens(user, res);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        phone: user.phone,
      },
      token: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
export const refresh = async (req, res, next) => {
  try {
    const refreshTokenString = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshTokenString) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const refreshToken = await RefreshToken.findOne({ token: refreshTokenString }).populate('user');

    if (!refreshToken || !refreshToken.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Revoke old token and generate new pair (Token Rotation)
    refreshToken.revoked = true;
    await refreshToken.save();

    const newAccessToken = await generateTokens(refreshToken.user, res);

    res.status(200).json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
export const logout = async (req, res, next) => {
  try {
    const refreshTokenString = req.cookies?.refreshToken;
    if (refreshTokenString) {
      await RefreshToken.findOneAndUpdate({ token: refreshTokenString }, { revoked: true });
    }

    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    
    if (phone && !/^(?:\+91|0)?[6-9]\d{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Indian mobile number' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'There is no user with that email',
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // In a real production app, send email here.
    // For now, return token in response for frontend handling.
    res.status(200).json({
      success: true,
      message: 'Reset token generated',
      data: resetToken, // Normally you wouldn't return this, but we lack an email provider
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
export const resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new token and login
    const token = user.generateToken();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      token,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user (Admin only)
// @route   POST /api/auth/users
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, permissions, isActive } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    let finalPermissions = permissions;
    if (!finalPermissions || !Array.isArray(finalPermissions) || finalPermissions.length === 0) {
      const roleDoc = await Role.findOne({ name: role || 'cashier' });
      finalPermissions = roleDoc ? roleDoc.permissions : [];
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'cashier',
      phone,
      permissions: finalPermissions,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        permissions: user.permissions,
        isActive: user.isActive
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user info, role & permissions (Admin only)
// @route   PUT /api/auth/users/:id
export const updateUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, permissions, isActive, password } = req.body;
    
    // Do not allow self demotion from admin
    if (req.user._id.toString() === req.params.id && role && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own admin role',
      });
    }

    // Do not allow deactivating self
    if (req.user._id.toString() === req.params.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
      user.email = email;
    }
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    
    if (role) {
      const validRoles = ['admin', 'manager', 'accountant', 'stock_manager', 'cashier'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role provided' });
      }
      
      // If role changed and no permissions passed, update to new role's defaults
      if (role !== user.role && (!permissions || !Array.isArray(permissions))) {
        const roleDoc = await Role.findOne({ name: role });
        if (roleDoc) user.permissions = roleDoc.permissions;
      }
      user.role = role;
    }

    if (permissions && Array.isArray(permissions)) {
      user.permissions = permissions;
    }

    if (password) {
      user.password = password;
    }

    await user.save(); // using save to trigger pre('save') for password hash if modified

    const updatedUser = await User.findById(req.params.id).select('-password');
    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
export const deleteUser = async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all roles and their default permissions (Admin only)
// @route   GET /api/auth/roles
export const getRoles = async (req, res, next) => {
  try {
    let roles = await Role.find({});
    
    // Auto-seed default roles if collection is empty
    if (roles.length === 0) {
      const defaultRoles = [
        { name: 'admin', permissions: ['dashboard', 'sales', 'purchases', 'inventory', 'products', 'categories', 'subcategories', 'customers', 'suppliers', 'accounting', 'bank', 'cash', 'cash-bank', 'expenses', 'loans', 'cheques', 'reports', 'settings', 'pos', 'activity', 'shifts', 'backup', 'transporters', 'utilities', 'checkout'] },
        { name: 'manager', permissions: ['dashboard', 'sales', 'purchases', 'inventory', 'products', 'categories', 'customers', 'suppliers', 'reports', 'pos', 'shifts'] },
        { name: 'accountant', permissions: ['dashboard', 'accounting', 'bank', 'cash', 'cash-bank', 'expenses', 'loans', 'cheques', 'reports'] },
        { name: 'stock_manager', permissions: ['dashboard', 'inventory', 'products', 'categories', 'subcategories', 'transporters'] },
        { name: 'cashier', permissions: ['dashboard', 'sales', 'customers', 'pos', 'shifts', 'checkout'] }
      ];
      await Role.insertMany(defaultRoles);
      roles = await Role.find({});
    }

    res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a role's default permissions (Admin only)
// @route   PUT /api/auth/roles/:id
export const updateRolePermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions array is required',
      });
    }

    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true, runValidators: true }
    );

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
};
