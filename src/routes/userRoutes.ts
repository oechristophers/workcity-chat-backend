import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  searchUsers,
  changePassword,
  updateProfile,
} from "../controllers/userController.js";

const router = Router();

router.use(authMiddleware);

router.get("/search", searchUsers); // /users/search?q=...
router.post("/password", changePassword); // body: { currentPassword, newPassword }
router.put("/profile", updateProfile); // optional alternative route (duplicate with /auth/profile)

export default router;
