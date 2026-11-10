import { pool } from '../config/db.js';

// 1. CREATE: Add Product 
export const addProduct = async (req, res) => {
  const { businessId, itemName, baseUnitName, totalBaseStock, baseCostPrice, baseSellingPrice, productType, packagingRules } = req.body;
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); 

    const productResult = await client.query(
      `INSERT INTO Products (business_id, item_name, base_unit_name, total_base_stock, base_cost_price, base_selling_price, product_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [businessId, itemName, baseUnitName, totalBaseStock, baseCostPrice || 0, baseSellingPrice || 0, productType || 'PHYSICAL']
    );

    const productId = productResult.rows[0].id;

    if (packagingRules && packagingRules.length > 0) {
      for (const rule of packagingRules) {
        await client.query(
          `INSERT INTO Product_Packaging (product_id, packaging_name, multiplier, cost_price, selling_price) 
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, rule.name, rule.multiplier, rule.cost, rule.selling]
        );
      }
    }

    await client.query('COMMIT'); 
    res.status(201).json({ status: 'success', message: 'Product added successfully!' });
  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Add Product Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to add product.' });
  } finally {
    client.release(); 
  }
};

// 2. READ: Get Inventory (🚀 FIX: Only fetch active products)
export const getInventory = async (req, res) => {
  const { businessId } = req.query;

  try {
    const result = await pool.query(
      `SELECT p.id, p.item_name, p.base_unit_name, p.total_base_stock, p.base_cost_price, p.base_selling_price, p.product_type,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', pr.id,
                    'packaging_name', pr.packaging_name,
                    'multiplier', pr.multiplier,
                    'cost_price', pr.cost_price,
                    'selling_price', pr.selling_price
                  )
                ) FILTER (WHERE pr.id IS NOT NULL), '[]'
              ) as packaging_rules
       FROM Products p
       LEFT JOIN Product_Packaging pr ON p.id = pr.product_id
       WHERE p.business_id = $1 AND p.is_active = TRUE
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [businessId]
    );

    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Fetch Inventory Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch inventory.' });
  }
};

// 3. UPDATE: Edit Product 
export const editProduct = async (req, res) => {
  const { productId, businessId, itemName, baseUnitName, totalBaseStock, baseCostPrice, baseSellingPrice, productType, packagingRules } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE Products 
       SET item_name = $1, 
           base_unit_name = $2, 
           total_base_stock = $3, 
           base_cost_price = $4, 
           base_selling_price = $5, 
           product_type = $6,
           needs_web_setup = CASE WHEN $5::numeric > 0 THEN FALSE ELSE needs_web_setup END
       WHERE id = $7 AND business_id = $8`,
      [itemName, baseUnitName, totalBaseStock, baseCostPrice, baseSellingPrice, productType, productId, businessId]
    );

    await client.query(`DELETE FROM Product_Packaging WHERE product_id = $1`, [productId]);

    if (packagingRules && packagingRules.length > 0) {
      for (const rule of packagingRules) {
        await client.query(
          `INSERT INTO Product_Packaging (product_id, packaging_name, multiplier, cost_price, selling_price) 
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, rule.name, rule.multiplier, rule.cost, rule.selling]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ status: 'success', message: 'Product updated successfully.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Edit Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update product.' });
  } finally {
    client.release();
  }
};

// 4. DELETE: Remove Product (🚀 FIX: The Soft Delete & Ghost Name Strategy)
export const deleteProduct = async (req, res) => {
  const { productId, businessId } = req.query;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Wipe the packaging rules (These don't affect old sales, so hard deleting is safe)
    await client.query(`DELETE FROM Product_Packaging WHERE product_id = $1`, [productId]);
    
    // 2. SOFT DELETE: Turn is_active to FALSE and append a unique timestamp to the name!
    await client.query(
      `UPDATE Products 
       SET is_active = FALSE, 
           item_name = item_name || ' (Deleted - ' || EXTRACT(EPOCH FROM NOW())::integer || ')'
       WHERE id = $1 AND business_id = $2`, 
      [productId, businessId]
    );
    
    await client.query('COMMIT');
    res.status(200).json({ status: 'success', message: 'Product archived cleanly. Financial history preserved.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete product.' });
  } finally {
    client.release();
  }
};

// 5. CREATE: Bulk Import Inventory (🚀 FIX: Only check against active products)
export const importInventory = async (req, res) => {
  const { businessId, items } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    for (const item of items) {
      const existingRes = await client.query(
        `SELECT id, total_base_stock FROM Products WHERE business_id = $1 AND item_name ILIKE $2 AND is_active = TRUE`,
        [businessId, item.itemName]
      );

      if (existingRes.rows.length > 0) {
        const existingItem = existingRes.rows[0];
        const additionalStock = item.totalBaseStock || 0;
        
        await client.query(
          `UPDATE Products SET total_base_stock = total_base_stock + $1 WHERE id = $2`,
          [additionalStock, existingItem.id]
        );
        console.log(`♻️ Merged ${additionalStock} stock into existing item: ${item.itemName}`);
      } else {
        await client.query(
          `INSERT INTO Products (business_id, item_name, base_unit_name, total_base_stock, base_cost_price, base_selling_price) 
           VALUES ($1, $2, $3, $4, 0, 0)`,
          [businessId, item.itemName, item.baseUnitName, item.totalBaseStock || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ status: 'success', message: `${items.length} products imported successfully!` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import inventory.' });
  } finally {
    client.release();
  }
};

// 6. READ: Pending Setup (🚀 FIX: Only fetch active products)
export const getPendingSetupProducts = async (req, res) => {
  const { businessId } = req.query;
  try {
    const result = await pool.query(
      `SELECT id, item_name, product_type 
       FROM Products 
       WHERE business_id = $1 AND needs_web_setup = TRUE AND is_active = TRUE`,
      [businessId]
    );
    res.status(200).json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Pending Setup Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch pending products.' });
  }
};