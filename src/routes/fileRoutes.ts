import { Router, Request } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { uploadBufferToFirebase } from "../config/firebase.js";
import { randomUUID } from "crypto";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}); // 10MB

interface MulterRequest extends Request {
  file?: any;
}

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req: MulterRequest, res, next) => {
    try {
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, message: "file required" });
      const mime = req.file.mimetype;
      let type: "image" | "video" | "document" | undefined;
      if (mime.startsWith("image/")) type = "image";
      else if (mime.startsWith("video/"))
        type = "video"; // client should ensure <=10s
      else if (
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].includes(mime)
      )
        type = "document";
      else
        return res
          .status(415)
          .json({ success: false, message: "Unsupported file type" });
      const key = `uploads/${new Date()
        .toISOString()
        .slice(0, 10)}/${randomUUID()}-${req.file.originalname}`;
      const { url } = await uploadBufferToFirebase(key, req.file.buffer, mime);
      res.json({
        success: true,
        data: {
          type,
          url,
          originalName: req.file.originalname,
          mimeType: mime,
          size: req.file.size,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
