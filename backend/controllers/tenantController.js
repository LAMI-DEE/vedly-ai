import { query } from '../config/db.js';
import jwt from 'jsonwebtoken';
// IMPORT YOUR WHATSAPP SENDER FUNCTION
import { sendWhatsAppMessage } from './whatsappController.js'; 

// ==========================================
// 🧠 TEMPORARY OTP MEMORY STORE (MVP ONLY)
// In a massive production app, we would use Redis or a DB table.
// For now, this ultra-fast memory map holds the OTPs for 10 minutes.
// ==========================================
const otpStore = new Map();

// Helper function to generate a 6-digit code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


// 1️⃣ REGISTER FLOW
export const requestRegisterOTP = async (req, res) => {
  const { fullName, whatsapp, businessName } = req.body;

  try {
    // 1. Check if number already exists
    const userCheck = await query(`SELECT id FROM Users WHERE phone_number = $1`, [whatsapp]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'This phone number is already registered to a business.' });
    }

    // 2. Generate OTP and save to memory
    const otpCode = generateOTP();
    otpStore.set(whatsapp, {
      code: otpCode,
      type: 'REGISTER',
      data: { fullName, businessName },
      expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    // 3. Send WhatsApp Message
    const msg = `Welcome to Vedly AI! 🚀\n\nYour registration verification code is: *${otpCode}*\n\nThis code expires in 10 minutes.`;
    await sendWhatsAppMessage(whatsapp, msg);

    console.log(`🔐 REGISTRATION OTP sent to ${whatsapp}: ${otpCode}`);
    res.status(200).json({ status: 'success', message: 'OTP sent to WhatsApp' });

  } catch (error) {
    console.error('Request Register OTP Error:', error);
    res.status(500).json({ message: 'Failed to generate OTP.' });
  }
};

export const verifyRegisterOTP = async (req, res) => {
  const { whatsapp, otp } = req.body;

  try {
    const record = otpStore.get(whatsapp);

    // Validate OTP exists, matches, and hasn't expired
    if (!record || record.type !== 'REGISTER' || record.code !== otp || Date.now() > record.expiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    const { fullName, businessName } = record.data;

    // Proceed to create Business and User
    await query('BEGIN');
    const bizResult = await query(`INSERT INTO Businesses (name) VALUES ($1) RETURNING id, name`, [businessName]);
    const newBusiness = bizResult.rows[0];

    const userResult = await query(
      `INSERT INTO Users (phone_number, business_id, role_type, name) VALUES ($1, $2, 'SME_OWNER', $3) RETURNING id, name, role_type`,
      [whatsapp, newBusiness.id, fullName]
    );
    const newUser = userResult.rows[0];
    await query('COMMIT');

    // Clean up OTP
    otpStore.delete(whatsapp);

    // Generate JWT & Cookie
    const token = jwt.sign({ id: newUser.id, businessId: newBusiness.id, role: newUser.role_type }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('tradeflow_jwt', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ status: 'success', data: { business: newBusiness, user: newUser } });

  } catch (error) {
    await query('ROLLBACK');
    console.error('Verify Register OTP Error:', error);
    res.status(500).json({ message: 'Failed to verify and register.' });
  }
};

// ==========================================
// 2️⃣ LOGIN FLOW
// ==========================================
export const requestLoginOTP = async (req, res) => {
  const { whatsapp } = req.body;

  try {
    // 1. Find user
    const userResult = await query(`SELECT id, role_type FROM Users WHERE phone_number = $1`, [whatsapp]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Phone number not found. Please register first.' });
    }

    const user = userResult.rows[0];

    // 2. IMPORTANT: Only allow SME_OWNERs to log into the web dashboard!
    if (user.role_type !== 'SME_OWNER') {
      return res.status(403).json({ message: 'Access Denied. Only Store Owners can access the web dashboard.' });
    }

    // 3. Generate and store OTP
    const otpCode = generateOTP();
    otpStore.set(whatsapp, {
      code: otpCode,
      type: 'LOGIN',
      expiresAt: Date.now() + (10 * 60 * 1000)
    });

    // 4. Send via WhatsApp
    const msg = `Vedly AI Security 🔒\n\nYour dashboard login code is: *${otpCode}*\n\nDo not share this code with anyone.`;
    await sendWhatsAppMessage(whatsapp, msg);

    console.log(`🔐 LOGIN OTP sent to ${whatsapp}: ${otpCode}`);
    res.status(200).json({ status: 'success', message: 'OTP sent to WhatsApp' });

  } catch (error) {
    console.error('Request Login OTP Error:', error);
    res.status(500).json({ message: 'Failed to send login code.' });
  }
};

export const verifyLoginOTP = async (req, res) => {
  const { whatsapp, otp } = req.body;

  try {
    const record = otpStore.get(whatsapp);

    if (!record || record.type !== 'LOGIN' || record.code !== otp || Date.now() > record.expiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    // Fetch full user and business details
    const userResult = await query(`SELECT * FROM Users WHERE phone_number = $1`, [whatsapp]);
    const user = userResult.rows[0];
    const bizResult = await query(`SELECT * FROM Businesses WHERE id = $1`, [user.business_id]);
    const business = bizResult.rows[0];

    // Clean up OTP
    otpStore.delete(whatsapp);

    // Generate JWT & Cookie
    const token = jwt.sign({ id: user.id, businessId: business.id, role: user.role_type }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.cookie('tradeflow_jwt', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ status: 'success', data: { user, business } });

  } catch (error) {
    console.error('Verify Login OTP Error:', error);
    res.status(500).json({ message: 'Failed to log in.' });
  }
};

// READ: Fetch all staff WITH their performance analytics
export const getStaff = async (req, res) => {
  const { businessId } = req.query;

  try {
    const result = await query(
      `SELECT u.id, u.name, u.phone_number, u.role_type, u.status, u.created_at,
              COALESCE(SUM(s.total_amount), 0) as total_sales,
              COUNT(s.id) as total_transactions
       FROM Users u
       LEFT JOIN Sales_Ledger s ON u.id = s.logged_by_user_id
       WHERE u.business_id = $1
       GROUP BY u.id
       ORDER BY u.created_at ASC`,
      [businessId]
    );

    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Fetch Staff Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch team members.' });
  }
};

// UPDATE: Edit Staff Details (With "Last Admin" Check)
export const editStaff = async (req, res) => {
  const { staffId, businessId, name, role_type } = req.body;
  try {
    // 1. Get current user state
    const currentUserReq = await query(`SELECT role_type, status FROM Users WHERE id = $1 AND business_id = $2`, [staffId, businessId]);
    const currentUser = currentUserReq.rows[0];

    // 2. If trying to demote an active Store Owner to Staff...
    if (currentUser.role_type === 'SME_OWNER' && currentUser.status === 'ACTIVE' && role_type === 'SME_STAFF') {
      const ownerCheck = await query(
        `SELECT COUNT(*) as count FROM Users WHERE business_id = $1 AND role_type = 'SME_OWNER' AND status = 'ACTIVE' AND id != $2`,
        [businessId, staffId]
      );
      if (parseInt(ownerCheck.rows[0].count) === 0) {
        return res.status(400).json({ status: 'error', message: 'Cannot demote the only active Store Owner. Promote another staff member first.' });
      }
    }

    // 3. Proceed with update
    await query(`UPDATE Users SET name = $1, role_type = $2 WHERE id = $3 AND business_id = $4`, [name, role_type, staffId, businessId]);
    res.status(200).json({ status: 'success', message: 'Staff details updated.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update staff.' });
  }
};

// UPDATE: Toggle Staff Status (With "Last Admin" Check)
export const toggleStaffStatus = async (req, res) => {
  const { staffId, businessId, newStatus } = req.body;
  try {
    const currentUserReq = await query(`SELECT role_type FROM Users WHERE id = $1 AND business_id = $2`, [staffId, businessId]);
    const currentUser = currentUserReq.rows[0];

    // If trying to suspend a Store Owner...
    if (currentUser.role_type === 'SME_OWNER' && newStatus === 'INACTIVE') {
      const ownerCheck = await query(
        `SELECT COUNT(*) as count FROM Users WHERE business_id = $1 AND role_type = 'SME_OWNER' AND status = 'ACTIVE' AND id != $2`,
        [businessId, staffId]
      );
      if (parseInt(ownerCheck.rows[0].count) === 0) {
        return res.status(400).json({ status: 'error', message: 'Cannot suspend the only active Store Owner.' });
      }
    }

    await query(`UPDATE Users SET status = $1 WHERE id = $2 AND business_id = $3`, [newStatus, staffId, businessId]);
    res.status(200).json({ status: 'success', message: `Staff marked as ${newStatus}.` });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update status.' });
  }
};

// DELETE: Remove Staff Member (With Sales AND "Last Admin" Check)
export const deleteStaff = async (req, res) => {
  const { staffId, businessId } = req.query;
  try {
    const currentUserReq = await query(`SELECT role_type, status FROM Users WHERE id = $1 AND business_id = $2`, [staffId, businessId]);
    const currentUser = currentUserReq.rows[0];

    // 🚀 FIX: Corrected column name from user_id to logged_by_user_id
    const salesCheck = await query(`SELECT id FROM Sales_Ledger WHERE logged_by_user_id = $1 LIMIT 1`, [staffId]);
    if (salesCheck.rows.length > 0) {
      return res.status(400).json({ status: 'error', message: 'Cannot delete staff with existing sales. Please deactivate them instead.' });
    }

    // 2. Last Admin Check
    if (currentUser.role_type === 'SME_OWNER' && currentUser.status === 'ACTIVE') {
      const ownerCheck = await query(
        `SELECT COUNT(*) as count FROM Users WHERE business_id = $1 AND role_type = 'SME_OWNER' AND status = 'ACTIVE' AND id != $2`,
        [businessId, staffId]
      );
      if (parseInt(ownerCheck.rows[0].count) === 0) {
        return res.status(400).json({ status: 'error', message: 'Cannot delete the only active Store Owner.' });
      }
    }

    await query(`DELETE FROM Users WHERE id = $1 AND business_id = $2`, [staffId, businessId]);
    res.status(200).json({ status: 'success', message: 'Staff member removed.' });
  } catch (error) {
    console.error("Delete Staff Error: ", error); // Add this to see future DB crashes in your terminal!
    res.status(500).json({ status: 'error', message: 'Failed to remove staff. If staff has sales, please deactivate them instead.' });
  }
};


export const addStaff = async (req, res) => {
  const { businessId, phone_number, name, role_type } = req.body;
  // role_type will be either 'SME_STAFF' or 'SME_OWNER'

  try {
    const result = await query(
      `INSERT INTO Users (business_id, phone_number, name, role_type) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, role_type`,
      [businessId, phone_number, name, role_type]
    );

    res.status(201).json({
      status: 'success',
      message: `${name} has been added to your team successfully! 🤝`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Add Staff Error:', error);
    // Error code 23505 is PostgreSQL's code for a Unique Constraint Violation
    if (error.code === '23505') {
      return res.status(400).json({ status: 'error', message: 'This phone number is already registered.' });
    }
    res.status(500).json({ status: 'error', message: 'Failed to add staff member.' });
  }
};

export const logoutTenant = (req, res) => {
  res.cookie('tradeflow_jwt', '', { maxAge: 1 }); // Overwrites the cookie with a 1-millisecond lifespan
  res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};


export const updateProfile = async (req, res) => {
  // These IDs come directly from our verifyToken middleware!
  const userId = req.user.id; 
  const businessId = req.user.businessId;
  const { fullName, businessName } = req.body;

  try {
    // 1. Update User Name
    const updatedUser = await query(
      `UPDATE Users SET name = $1 WHERE id = $2 RETURNING id, name, phone_number, role_type, business_id`,
      [fullName, userId]
    );

    // 2. Update Business Name
    const updatedBusiness = await query(
      `UPDATE Businesses SET name = $1 WHERE id = $2 RETURNING id, name`,
      [businessName, businessId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: { user: updatedUser.rows[0], business: updatedBusiness.rows[0] }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update profile.' });
  }
};

export const updatePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    // 1. Fetch current password hash
    const userResult = await query(`SELECT password_hash FROM Users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];

    // 2. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ status: 'error', message: 'Incorrect current password.' });
    }

    // 3. Hash and save the new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await query(`UPDATE Users SET password_hash = $1 WHERE id = $2`, [newPasswordHash, userId]);

    res.status(200).json({ status: 'success', message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Update Password Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update password.' });
  }
};

// READ: Fetch specific stats for a single staff member based on a date filter
export const getStaffStats = async (req, res) => {
  const { staffId, businessId, days = 7 } = req.query;
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days) + 1);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 1. The Totals
    const statsQuery = await query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_sales,
              COUNT(id) as total_transactions
       FROM Sales_Ledger
       WHERE logged_by_user_id = $1 AND business_id = $2 AND DATE(created_at) >= $3 AND DATE(created_at) <= $4`,
      [staffId, businessId, startStr, endStr]
    );

    // 2. The Breakdown (Grouped by Item)
    const breakdownQuery = await query(
      `SELECT p.item_name, SUM(sl.quantity_sold_base) as quantity, SUM(sl.total_amount) as amount
       FROM Sales_Ledger sl
       JOIN Products p ON sl.product_id = p.id
       WHERE sl.logged_by_user_id = $1 AND sl.business_id = $2 AND DATE(sl.created_at) >= $3 AND DATE(sl.created_at) <= $4
       GROUP BY p.item_name
       ORDER BY amount DESC`,
       [staffId, businessId, startStr, endStr]
    );

    res.status(200).json({ 
      status: 'success', 
      data: { 
        ...statsQuery.rows[0], 
        breakdown: breakdownQuery.rows // Send the array of items to the frontend
      } 
    });
  } catch (error) {
    console.error('Staff Stats Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch staff stats.' });
  }
};

// 🚀 NEW: Automated WhatsApp Welcome Trigger
export const sendWelcomeInvite = async (req, res) => {
  const { staffName, staffPhone, businessId } = req.body;

  try {
    // Fetch the business name to personalize the message
    const bizRes = await query(`SELECT name FROM Businesses WHERE id = $1`, [businessId]);
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Business not found.' });
    }
    const businessName = bizRes.rows[0].name;

    // The perfectly formatted automated message
    const msg = `🎉 Yay! Welcome to Vedly AI, ${staffName}.\n\nYou have been officially added as a sales personnel for *${businessName}*.\n\nI am the AI assistant. You can log sales, track expenses, and check inventory right here in this chat.\n\nTo log something, just type it naturally, like:\n✍🏾 *"Sold 1 bag of rice for 10k"*\n✍🏾 *"Spent 2k on transport"*\n\nLet's get to work! 🚀`;

    // Trigger Meta API
    await sendWhatsAppMessage(staffPhone, msg);

    res.status(200).json({ status: 'success', message: 'Welcome message sent successfully!' });
  } catch (error) {
    console.error('Send Welcome Invite Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to send welcome message.' });
  }
};