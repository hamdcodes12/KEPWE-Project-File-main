import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { answerChatMessage } from '../services/chatbot.service.js';

const router = express.Router();

const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat limit reached. Please try again shortly.' },
});

const messageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(600, 'Message is too long'),
}).strict();

router.post('/chatbot/message', requireAuth, chatbotLimiter, validateBody(messageSchema), async (req, res, next) => {
  try {
    const result = await answerChatMessage(req.userId, req.validatedBody.message);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
