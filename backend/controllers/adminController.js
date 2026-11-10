import { pool, query } from '../config/db.js';

export const getGlobalMetrics = async (req, res) => {
  try {
    // 1. Get total platform numbers
    const bizCount = await pool.query(`SELECT COUNT(*) FROM Businesses`);
    const userCount = await pool.query(`SELECT COUNT(*) FROM Users`);
    const volume = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) FROM Sales_Ledger`);
    
    // For now, Active AI Agents = Active Businesses. In Phase 5, this will track actual WhatsApp Webhook connections!
    const activeAgents = await pool.query(`SELECT COUNT(*) FROM Businesses WHERE status = 'ACTIVE'`);

    // 2. Get the list of all businesses with their macro-stats (No privacy invasion!)
    const tenants = await pool.query(`
      SELECT 
        b.id as business_id, b.name as business_name, b.created_at, b.status,
        u.name as owner_name, u.phone_number as owner_phone,
        (SELECT COUNT(*) FROM Users WHERE business_id = b.id) as staff_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM Sales_Ledger WHERE business_id = b.id) as total_volume
      FROM Businesses b
      JOIN Users u ON b.id = u.business_id
      WHERE u.role_type IN ('SME_OWNER', 'SUPER_ADMIN')
      ORDER BY b.created_at DESC
    `);

    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          totalBusinesses: parseInt(bizCount.rows[0].count),
          totalUsers: parseInt(userCount.rows[0].count),
          totalVolume: parseFloat(volume.rows[0].coalesce),
          activeAgents: parseInt(activeAgents.rows[0].count)
        },
        tenants: tenants.rows
      }
    });
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch global metrics.' });
  }
};

// 3. NEW: Suspend or Activate an entire business
export const toggleBusinessStatus = async (req, res) => {
  const { targetBusinessId, newStatus } = req.body; // newStatus: 'ACTIVE' or 'SUSPENDED'
  try {
    await query(`UPDATE Businesses SET status = $1 WHERE id = $2`, [newStatus, targetBusinessId]);
    res.status(200).json({ status: 'success', message: `Business marked as ${newStatus}.` });
  } catch (error) {
    console.error('Toggle Business Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update business status.' });
  }
};