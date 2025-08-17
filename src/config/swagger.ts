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
  paths: {
    "/auth/profile": {
      put: {
        summary:
          "Update current user profile (name, username, profilePicture, optional password change)",
        tags: ["Auth"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateProfileRequest" },
            },
          },
        },
        responses: {
          200: { description: "Profile updated" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          409: { description: "Username already taken" },
        },
      },
    },
    "/files/upload": {
      post: {
        summary:
          "Upload a file (image, short video ≤10s, PDF or Word doc) and receive attachment descriptor",
        tags: ["Files"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Upload successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadResponse" },
              },
            },
          },
          400: { description: "Missing file" },
          401: { description: "Unauthorized" },
          415: { description: "Unsupported file type" },
        },
      },
    },
    "/admin/metrics": {
      get: {
        summary: "Fetch platform metrics (admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Metrics returned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        users: { type: "integer" },
                        conversations: { type: "integer" },
                        messages: { type: "integer" },
                        attachments: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/admin/conversations/{id}": {
      delete: {
        summary: "Delete a conversation and its messages (admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
            description: "Conversation ID",
          },
        ],
        responses: {
          200: { description: "Conversation deleted" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/admin/users/{userId}/messages": {
      delete: {
        summary: "Purge all messages by a user (admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string" },
            description: "User ID whose messages will be purged",
          },
        ],
        responses: {
          200: { description: "User messages purged" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/admin/users": {
      get: {
        summary: "List users (admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Users listed" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/admin/users/{userId}/role": {
      put: {
        summary: "Update a user's role (admin only)",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: "path",
            name: "userId",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: { role: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Role updated" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "User not found" },
        },
      },
    },
  },
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
          participants: {
            type: "array",
            items: { $ref: "#/components/schemas/UserPublic" },
          },
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
          sender: { $ref: "#/components/schemas/UserPublic" },
          content: { type: "string" },
          status: { type: "string", enum: ["sent", "delivered", "read"] },
          readBy: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/Attachment" },
          },
        },
      },
      Attachment: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["image", "video", "document"] },
          url: { type: "string" },
          originalName: { type: "string" },
          mimeType: { type: "string" },
          size: { type: "integer" },
          durationSeconds: { type: "number" },
        },
      },
      UserPublic: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          username: { type: "string" },
          profilePicture: { type: "string" },
          role: { type: "string" },
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
        description:
          "Provide either content (non-empty) or at least one attachment.",
        required: ["conversationId"],
        properties: {
          conversationId: { type: "string" },
          content: { type: "string" },
          attachments: {
            type: "array",
            items: { $ref: "#/components/schemas/Attachment" },
          },
        },
      },
      UpdateProfileRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          username: { type: "string" },
          profilePicture: { type: "string" },
          password: { type: "string" },
          currentPassword: { type: "string" },
        },
      },
      UploadResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          attachment: { $ref: "#/components/schemas/Attachment" },
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
