import "express";
import { TokenPayload } from "../../interfaces/RequestWithUser";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}
