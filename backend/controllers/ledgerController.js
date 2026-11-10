import { pool } from '../config/db.js';

export const logSale = async (req, res) => {
  const { businessId, userId, productId, quantitySoldBase, totalAmount } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // 🔒 Lock the vault!

    // 1. Insert the money into the Sales Ledger
    await client.query(
      `INSERT INTO Sales_Ledger (business_id, product_id, logged_by_user_id, quantity_sold_base, total_amount) 
       VALUES ($1, $2, $3, $4, $5)`,
      [businessId, productId, userId, quantitySoldBase, totalAmount]
    );

    // 2. Deduct the inventory from the Products table
    await client.query(
      `UPDATE Products 
       SET total_base_stock = total_base_stock - $1 
       WHERE id = $2 AND business_id = $3`,
      [quantitySoldBase, productId, businessId]
    );

    await client.query('COMMIT'); // 🔓 Everything worked! Save it.

    res.status(201).json({
      status: 'success',
      message: `Sale logged successfully! Removed ${quantitySoldBase} units from stock. 💸`
    });

  } catch (error) {
    await client.query('ROLLBACK'); // 🚨 Error! Undo the sale.
    console.error('Sale Logging Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to log the sale.' });
  } finally {
    client.release();
  }
};


// 2. READ: Fetch Recent Sales for the Audit Tab
export const getRecentSales = async (req, res) => {
  const { businessId } = req.query;
  try {
     const result = await pool.query(
       `SELECT sl.id, sl.created_at, sl.total_amount, sl.quantity_sold_base, p.item_name, p.product_type, u.name as logged_by
        FROM Sales_Ledger sl
        JOIN Products p ON sl.product_id = p.id
        LEFT JOIN Users u ON sl.logged_by_user_id = u.id
        WHERE sl.business_id = $1
        ORDER BY sl.created_at DESC LIMIT 50`,
       [businessId]
     );
     res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
     console.error('Fetch Ledger Error:', error);
     res.status(500).json({ status: 'error', message: 'Failed to fetch ledger data.' });
  }
};

// 3. DELETE: The Safe Delete Protocol
export const deleteSale = async (req, res) => {
  // We expect the frontend to pass the user ID so we know who authorized the deletion
  const { saleId, businessId, userId } = req.query; 
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step A: Find the exact sale and its details
    const saleRes = await client.query(
      `SELECT product_id, quantity_sold_base, total_amount FROM Sales_Ledger WHERE id = $1 AND business_id = $2`,
      [saleId, businessId]
    );

    if (saleRes.rows.length === 0) {
      throw new Error("Sale not found or already deleted.");
    }
    const sale = saleRes.rows[0];

    // Step B: Check the product type
    const productRes = await client.query(
      `SELECT product_type, item_name FROM Products WHERE id = $1`,
      [sale.product_id]
    );

    let itemName = "an item";
    if (productRes.rows.length > 0) {
      const product = productRes.rows[0];
      itemName = product.item_name;
      
      // Step C: If it's a physical item, put the stock back on the shelf!
      if (product.product_type === 'PHYSICAL') {
        await client.query(
          `UPDATE Products SET total_base_stock = total_base_stock + $1 WHERE id = $2`,
          [sale.quantity_sold_base, sale.product_id]
        );
      }
    }

    // Step D: Safely delete the row from the Ledger
    await client.query(`DELETE FROM Sales_Ledger WHERE id = $1`, [saleId]);

    // Step E: Create an immutable Audit Trail log
    await client.query(
      `INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
       VALUES ($1, $2, 'AGENT', $3)`,
      [businessId, userId, `[ADMIN ACTION] Manually deleted a past sale of ₦${sale.total_amount} for ${sale.quantity_sold_base}x ${itemName} from the web dashboard. Stock restored if physical.`]
    );

    await client.query('COMMIT');
    res.status(200).json({ status: 'success', message: 'Sale securely deleted and stock restored.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete Sale Error:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to delete sale.' });
  } finally {
    client.release();
  }
};

export const deleteLedgerRecord = async (req, res) => {
  const { id, type, businessId, userId } = req.query;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (type === 'SALE') {
      // 1. Get the sale details to find the product ID and quantity
      const saleRes = await client.query(`SELECT product_id, quantity_sold_base, total_amount FROM Sales_Ledger WHERE id = $1 AND business_id = $2`, [id, businessId]);
      
      if (saleRes.rows.length > 0) {
        const sale = saleRes.rows[0];

        // 2. Restock ONLY if it's a PHYSICAL item
        const productRes = await client.query(`SELECT item_name, product_type FROM Products WHERE id = $1`, [sale.product_id]);
        if (productRes.rows.length > 0 && productRes.rows[0].product_type === 'PHYSICAL') {
          await client.query(`UPDATE Products SET total_base_stock = total_base_stock + $1 WHERE id = $2`, [sale.quantity_sold_base, sale.product_id]);
        }

        // 3. Delete the sale
        await client.query(`DELETE FROM Sales_Ledger WHERE id = $1`, [id]);

        // 4. Log the audit
        const itemName = productRes.rows.length > 0 ? productRes.rows[0].item_name : 'Unknown Item';
        await client.query(`
          INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
          VALUES ($1, $2, 'AGENT', $3)
        `, [businessId, userId, `Admin securely deleted a past sale of ₦${sale.total_amount} for ${itemName}. Stock updated.`]);
      }
    } 
    else if (type === 'EXPENSE') {
      // 1. Get expense details for the log
      const expRes = await client.query(`SELECT amount, description FROM Expenses_Ledger WHERE id = $1 AND business_id = $2`, [id, businessId]);
      
      if (expRes.rows.length > 0) {
        // 2. Delete the expense
        await client.query(`DELETE FROM Expenses_Ledger WHERE id = $1`, [id]);

        // 3. Log the audit
        await client.query(`
          INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
          VALUES ($1, $2, 'AGENT', $3)
        `, [businessId, userId, `Admin securely deleted a past expense of ₦${expRes.rows[0].amount} for ${expRes.rows[0].description}.`]);
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ status: 'success', message: 'Record securely erased.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete Ledger Record Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete record.' });
  } finally {
    client.release();
  }
};

// READ: Fetch Unified Ledger (Sales + Expenses combined)
export const getLedgerHistory = async (req, res) => {
  const { businessId, startDate, endDate } = req.query;

  try {
    // Default to last 7 days if dates aren't provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    if (!startDate) start.setDate(end.getDate() - 7);

    // Add 1 day to the end date to ensure we capture events up to 23:59:59 of that day
    const endPlusOne = new Date(end);
    endPlusOne.setDate(endPlusOne.getDate() + 1);

    const startStr = start.toISOString().split('T')[0];
    const endStr = endPlusOne.toISOString().split('T')[0];

    const result = await pool.query(
      `
      SELECT 
        sl.id, sl.created_at, 'SALE' as type, sl.total_amount as amount, 
        (sl.quantity_sold_base || 'x ' || p.item_name) as description, u.name as logged_by
      FROM Sales_Ledger sl
      JOIN Products p ON sl.product_id = p.id
      LEFT JOIN Users u ON sl.logged_by_user_id = u.id
      WHERE sl.business_id = $1 AND sl.created_at >= $2 AND sl.created_at < $3

      UNION ALL

      SELECT 
        el.id, el.created_at, 'EXPENSE' as type, el.amount as amount, 
        el.description as description, u.name as logged_by
      FROM Expenses_Ledger el
      LEFT JOIN Users u ON el.logged_by_user_id = u.id
      WHERE el.business_id = $1 AND el.created_at >= $2 AND el.created_at < $3

      ORDER BY created_at DESC LIMIT 200
      `,
      [businessId, startStr, endStr]
    );

    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Fetch Unified Ledger Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch ledger data.' });
  }
};