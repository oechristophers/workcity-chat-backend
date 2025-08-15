import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listConversations,
  getConversationMessages,
  createConversation,
  postMessage,
  markMessagesRead,
  totalUnread,
} from "../controllers/chatController.js";

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: List conversations for current user (with unread counts)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *         required: false
 *         description: Page size (default 20, max 100)
 *     responses:
 *       200:
 *         description: List of conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Conversation' }
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create a new conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateConversationRequest' }
 *     responses:
 *       201:
 *         description: Created conversation
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 * /chat/conversations/unread/total:
 *   get:
 *     summary: Get total unread messages across all conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total unread count
 *       401:
 *         description: Unauthorized
 * /chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *         required: true
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number for pagination (optional)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *         required: false
 *         description: Page size (optional)
 *     responses:
 *       200:
 *         description: Messages
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 * /chat/messages:
 *   post:
 *     summary: Send a message (HTTP alternative to socket)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PostMessageRequest' }
 *     responses:
 *       201:
 *         description: Message created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 * /chat/messages/read:
 *   post:
 *     summary: Mark all messages in a conversation as read
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MarkReadRequest' }
 *     responses:
 *       200:
 *         description: Marked read
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get("/conversations", listConversations);
router.get("/conversations/unread/total", totalUnread);
router.get("/conversations/:id/messages", getConversationMessages);
router.post("/conversations", createConversation);
router.post("/messages", postMessage);
router.post("/messages/read", markMessagesRead);

export default router;
