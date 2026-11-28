import { z } from "zod";

export const entryContentSchema = z.object({
  title: z.string().min(1).max(200),
  originalText: z.string().min(1).max(20000),
  journal: z.string().min(1).max(100),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryTime: z.string().regex(/^\d{2}:\d{2}$/),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mood: z.number().int().min(1).max(5),
  people: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,30}$/)).default([]),
  tags: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,30}$/)).default([]),
  isFavorite: z.boolean().default(false),
  isDraft: z.boolean().default(true),
  writingMode: z.enum(["verbatim", "lightfix", "review"]).default("verbatim"),
});

export type EntryContent = z.infer<typeof entryContentSchema>;

export const createEntrySchema = entryContentSchema;
export type CreateEntryDto = z.infer<typeof createEntrySchema>;

export const editEntrySchema = entryContentSchema.partial();
export type EditEntryDto = z.infer<typeof editEntrySchema>;
