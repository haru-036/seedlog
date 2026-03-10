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

// ---- GitHub Webhook ----

const githubCommitSchema = z.object({
  id: z.string(),
  added: z.array(z.string()).default([]),
  modified: z.array(z.string()).default([]),
  removed: z.array(z.string()).default([])
});

export const githubPushPayloadSchema = z.object({
  ref: z.string(),
  head_commit: z
    .object({
      id: z.string()
    })
    .nullable(),
  commits: z.array(githubCommitSchema).default([]),
  repository: z.object({
    full_name: z.string()
  }),
  pusher: z.object({
    name: z.string()
  })
});

export type GitHubPushPayload = z.infer<typeof githubPushPayloadSchema>;

// ---- Discord Interactions ----

export const discordInteractionSchema = z.object({
  type: z.number().int(),
  data: z
    .object({
      custom_id: z.string().optional(),
      name: z.string().optional(),
      components: z
        .array(
          z.object({
            type: z.number(),
            components: z
              .array(z.object({ type: z.number(), custom_id: z.string(), value: z.string().optional() }))
              .optional()
          })
        )
        .optional()
    })
    .optional(),
  member: z.object({ user: z.object({ id: z.string() }) }).optional(),
  user: z.object({ id: z.string() }).optional()
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;
