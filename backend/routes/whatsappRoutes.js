// routes/whatsappRoutes.js
import express from 'express';
import { verifyWebhook, receiveMessage } from '../controllers/whatsappController.js';

const router = express.Router();

// The GET route for Meta's security check
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveMessage); // The POST route to catch incoming messages

export default router;