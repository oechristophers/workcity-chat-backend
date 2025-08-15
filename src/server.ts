import { config } from "dotenv";
config();
import mongoose from "mongoose";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./socket/index.js";

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  process.exit(0);
});
