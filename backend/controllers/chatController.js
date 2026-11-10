import { pool } from '../config/db.js';

// 1. Save a message to the database
export const saveChatMessage = async (req, res) => {
  const { businessId, userId, senderType, messageContent } = req.body;

  // Security check: senderType must be 'USER' or 'AGENT' (matches our SQL schema)
  if (senderType !== 'USER' && senderType !== 'AGENT') {
    return res.status(400).json({ status: 'error', message: 'Invalid senderType' });
  }

  try {
    await pool.query(
      `INSERT INTO Chat_Logs (business_id, user_id, sender_type, message_content) 
       VALUES ($1, $2, $3, $4)`,
      [businessId, userId, senderType, messageContent]
    );

    res.status(201).json({ status: 'success', message: 'Message saved to memory. 🧠' });
  } catch (error) {
    console.error('Chat Saving Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to save chat log.' });
  }
};

// 2. Retrieve the last 10 messages for context
export const getChatHistory = async (req, res) => {
  const { businessId, userId } = req.query;

  try {
    const result = await pool.query(
      `SELECT sender_type, message_content, created_at 
       FROM Chat_Logs 
       WHERE business_id = $1 AND user_id = $2 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [businessId, userId]
    );

    // We order by DESC to get the newest, but we reverse it so they are in chronological order for the AI
    const chronologicalHistory = result.rows.reverse();

    res.status(200).json({
      status: 'success',
      data: chronologicalHistory
    });
  } catch (error) {
    console.error('Chat Fetching Error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch chat history.' });
  }
};