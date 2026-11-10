import { pool } from '../config/db.js';

export const getDashboardSummary = async (req, res) => {
  const { businessId, days = 7 } = req.query;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days) + 1);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 🚀 NEW: We now fetch BOTH Revenue AND Total Item Cost!
    const revenueQuery = await pool.query(
      `SELECT 
         COALESCE(SUM(total_amount), 0) as total_revenue,
         COALESCE(SUM(total_cost), 0) as total_cogs
       FROM Sales_Ledger 
       WHERE business_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
      [businessId, startStr, endStr]
    );
    
    const expenseQuery = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM Expenses_Ledger 
       WHERE business_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
      [businessId, startStr, endStr]
    );

    const totalRevenue = parseFloat(revenueQuery.rows[0].total_revenue);
    const totalCogs = parseFloat(revenueQuery.rows[0].total_cogs); // Cost of Goods Sold
    const operatingExpenses = parseFloat(expenseQuery.rows[0].total);

    // 🚀 NEW: True Enterprise Accounting Math
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - operatingExpenses;

    const chartQuery = await pool.query(
      `SELECT DATE(created_at) as sale_date, SUM(total_amount) as daily_revenue
       FROM Sales_Ledger
       WHERE business_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [businessId, startStr, endStr]
    );

    const chartData = chartQuery.rows.map(row => {
      const d = new Date(row.sale_date);
      const formattedDate = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${d.toLocaleDateString('en-US', { weekday: 'short' })})`;
      return { name: formattedDate, revenue: parseFloat(row.daily_revenue) };
    });

    const lowStockQuery = await pool.query(
      `SELECT item_name, total_base_stock 
       FROM Products 
       WHERE business_id = $1 AND total_base_stock < 20 AND product_type = 'PHYSICAL'
       ORDER BY total_base_stock ASC LIMIT 3`,
      [businessId]
    );

    const activityQuery = await pool.query(
      `SELECT c.message_content, c.sender_type, c.created_at, u.name as sender_name
       FROM Chat_Logs c
       LEFT JOIN Users u ON c.user_id = u.id
       WHERE c.business_id = $1
       ORDER BY c.created_at DESC LIMIT 50`,
      [businessId]
    );

    res.status(200).json({
      status: 'success',
      data: {
        totalRevenue,
        grossProfit, // 👈 Exporting Gross Profit
        operatingExpenses, 
        netProfit,   // 👈 Exporting True Net Profit
        lowStockAlerts: lowStockQuery.rows,
        chartData,
        activityLogs: activityQuery.rows 
      }
    });
  } catch (error) {
    console.error('Dashboard Fetch Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch dashboard data.' });
  }
};

export const getFinancialStatement = async (req, res) => {
  const { businessId, startDate, endDate } = req.query;

  try {
    // 1. Establish strict date boundaries
    // If no dates are sent from the frontend, we default to the Last 30 Days to protect the server
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultEnd.getDate() - 30);

    // Format strictly for PostgreSQL (YYYY-MM-DD)
    const startStr = startDate || defaultStart.toISOString().split('T')[0];
    const endStr = endDate || defaultEnd.toISOString().split('T')[0];

    // 2. Fetch Scoped Sales
    const salesResult = await pool.query(
      `SELECT created_at as date, 'Product Sale' as description, 'Credit' as type, total_amount as amount 
       FROM Sales_Ledger 
       WHERE business_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
      [businessId, startStr, endStr]
    );

    // 3. Fetch Scoped Expenses
    const expensesResult = await pool.query(
      `SELECT created_at as date, description, 'Debit' as type, amount 
       FROM Expenses_Ledger 
       WHERE business_id = $1 AND DATE(created_at) >= $2 AND DATE(created_at) <= $3`,
      [businessId, startStr, endStr]
    );

    // 4. Combine and Calculate
    const rawSales = salesResult.rows;
    const rawExpenses = expensesResult.rows;

    const totalRevenue = rawSales.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const totalExpenses = rawExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const netProfit = totalRevenue - totalExpenses;

    const combinedLedger = [...rawSales, ...rawExpenses].sort((a, b) => {
      return new Date(b.date) - new Date(a.date); // Newest first
    });

    res.status(200).json({
      status: 'success',
      data: {
        period: { start: startStr, end: endStr }, // 👈 Send the exact period back so the PDF can print it!
        totalRevenue,
        totalExpenses,
        netProfit,
        ledger: combinedLedger
      }
    });

  } catch (error) {
    console.error('Financial Statement Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate financial statement.' });
  }
};