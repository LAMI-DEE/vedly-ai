import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config(); // Loads the .env file

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true, 
//   keepAlive: true, // Tells Node to keep the TCP connection open
//   idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
//   connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection immediately when the server starts
pool.connect()
  .then(() => console.log(' Connected to Neon PostgreSQL (Frankfurt)'))
  .catch((err) => console.error('❌ Database connection error:', err.stack));


  // Catch idle connection errors so the server doesn't crash
pool.on('error', (err, client) => {
  console.error('⚠️ Unexpected error on idle PostgreSQL client', err.message);
  // The server will no longer crash, it will just log this and move on!
});
// Export the query function so our controllers can use it later
export const query = (text, params) => pool.query(text, params);



export {pool};