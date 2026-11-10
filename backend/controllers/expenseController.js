import { pool } from '../config/db.js';

export const logExpense = async (req, res) => {
  const { businessId, userId, amount, description } = req.body;

  try {
    // Insert the expense into the Expenses Ledger
    const result = await pool.query(
      `INSERT INTO Expenses_Ledger (business_id, logged_by_user_id, amount, description) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [businessId, userId, amount, description]
    );

    res.status(201).json({
      status: 'success',
      message: `Expense of ₦${amount} for "${description}" logged successfully! 📉`
    });

  } catch (error) {
    console.error('Expense Logging Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to log the expense.' });
  }
};