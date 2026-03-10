import { z } from "zod";

// ---- Users ----

export const createUserSchema = z.object({
  discordId: z.string().min(1, "discordIdは必須です"),
  githubLogin: z.string().min(1, "githubLoginは必須です")
});

export const userResponseSchema = z.object({
  id: z.string(),
  discordId: z.string(),
  githubLogin: z.string(),
  createdAt: z.string()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
