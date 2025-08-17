import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import {
  getMetrics,
  deleteConversation,
  purgeUserMessages,
  listUsers,
  updateUserRole,
} from "../controllers/adminController.js";
import {
  adminRateLimiter,
  auditAction,
} from "../middlewares/adminEnhancements.js";

const router = Router();

router.use(authMiddleware, roleMiddleware(["admin"]), adminRateLimiter);

router.get("/metrics", auditAction("metrics"), getMetrics);
router.get("/users", auditAction("list_users"), listUsers);
router.put(
  "/users/:userId/role",
  auditAction("update_user_role", "userId"),
  updateUserRole
);
router.delete(
  "/conversations/:id",
  auditAction("delete_conversation", "id"),
  deleteConversation
);
router.delete(
  "/users/:userId/messages",
  auditAction("purge_user_messages", "userId"),
  purgeUserMessages
);

export default router;
