import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/db.js'; // This imports and runs our database connection
import routes from './routes/index.js';
import cookieParser from 'cookie-parser'; // 👈 1. Add this import at the top
import whatsappRoutes from './routes/whatsappRoutes.js'; // 👈 Import the WhatsApp routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // You must specify the exact frontend URL, Allows your Next.js frontend to talk to this API
  credentials: true                // 👈 This tells the browser "Allow cookies!"
})); 
app.use(express.json()); // Allows Express to read JSON data from WhatsApp
app.use(cookieParser());
app.use('/api/whatsapp', whatsappRoutes);

app.use('/api', routes);
// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'TradeFlow API is running smoothly' });
});

// Start the engine
app.listen(PORT, () => {
  console.log(`🔥 Server is running on http://localhost:${PORT}`);
});