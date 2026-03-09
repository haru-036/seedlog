import { z } from "zod";

// Example: seed log entry schema
export const seedLogSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  plantedAt: z.string().datetime(),
  notes: z.string().optional(),
});

export const createSeedLogSchema = seedLogSchema.omit({ id: true });

export type SeedLog = z.infer<typeof seedLogSchema>;
export type CreateSeedLog = z.infer<typeof createSeedLogSchema>;
