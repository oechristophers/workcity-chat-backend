import express from "express";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler, notFoundHandler } from "./utils/errorHandler.js";

const app = express();

// CORS configuration
// If you need cookies (withCredentials) from frontend (localhost:3000) set credentials: true and an explicit origin list ("*" not allowed with credentials)
const defaultOrigins = ["http://localhost:3000"]; // dev frontend
const envOrigin = process.env.CLIENT_URL; // optional, e.g. https://your-prod-domain.com
const allowedOrigins = [...defaultOrigins, envOrigin].filter(
  Boolean
) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no origin) and any origin in the allowlist
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, origin || true);
      }
      return callback(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"],
  })
);

// Explicit preflight handling (mainly for legacy proxies) – optional but explicit
app.options("*", cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/files", fileRoutes);
app.use("/users", userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
