import { z } from "zod";

export const message = z.object({
  id: z.string(),
  sender: z.string(),
  recipient: z.string(),
  message_type: z.string(),
  payload: z.string(),
  created_at: z.string(),
  status: z.string().default("pending"),
});

export const MessageModel = {
  tableName: "messages",
  primaryKeys: ["id"],
  schema: message,
  serializer: (obj: Record<string, string | number | boolean | null>) => {
    return { ...obj };
  },
  serializerObject: message,
};
