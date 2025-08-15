import swaggerJsdoc from "swagger-jsdoc";
import type { OpenAPIV3 } from "openapi-types";

const definition: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Workcity Chat API",
    version: "1.0.0",
    description: "Authentication service with JWT access & refresh tokens",
  },
  servers: [
    {
      url: "http://localhost:" + (process.env.PORT || 5000),
      description: "Local dev",
    },
  ],
  paths: {},
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
          role: {
            type: "string",
            enum: ["admin", "agent", "customer", "designer", "merchant"],
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } },
      },
      LogoutRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string" } },
      },
      Conversation: {
        type: "object",
        properties: {
          _id: { type: "string" },
          participants: { type: "array", items: { type: "string" } },
          lastMessage: { $ref: "#/components/schemas/Message" },
          updatedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          unreadCount: { type: "integer" },
        },
      },
      Message: {
        type: "object",
        properties: {
          _id: { type: "string" },
          conversation: { type: "string" },
          sender: { type: "string" },
          content: { type: "string" },
          status: { type: "string", enum: ["sent", "delivered", "read"] },
          readBy: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateConversationRequest: {
        type: "object",
        required: ["participants"],
        properties: {
          participants: { type: "array", items: { type: "string" } },
        },
      },
      PostMessageRequest: {
        type: "object",
        required: ["conversationId", "content"],
        properties: {
          conversationId: { type: "string" },
          content: { type: "string" },
        },
      },
      MarkReadRequest: {
        type: "object",
        required: ["conversationId"],
        properties: { conversationId: { type: "string" } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  definition,
  apis: ["src/routes/*.ts", "src/controllers/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
