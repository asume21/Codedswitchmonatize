import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  json,
  jsonb,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, inactive, canceled, past_due
  subscriptionTier: text("subscription_tier").default("free"), // free, basic, pro
  // Usage tracking for sustainable freemium model
  monthlyUploads: integer("monthly_uploads").default(0),
  monthlyGenerations: integer("monthly_generations").default(0),
  lastUsageReset: timestamp("last_usage_reset").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const codeTranslations = pgTable("code_translations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sourceLanguage: text("source_language").notNull(),
  targetLanguage: text("target_language").notNull(),
  sourceCode: text("source_code").notNull(),
  translatedCode: text("translated_code").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const beatPatterns = pgTable("beat_patterns", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  pattern: json("pattern").notNull(),
  bpm: integer("bpm").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const melodies = pgTable("melodies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  notes: json("notes").notNull(),
  scale: text("scale").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vulnerabilityScans = pgTable("vulnerability_scans", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  code: text("code").notNull(),
  results: json("results").notNull(),
  language: text("language").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lyrics = pgTable("lyrics", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  genre: text("genre"),
  rhymeScheme: text("rhyme_scheme"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  data: true,
});

export const insertCodeTranslationSchema = createInsertSchema(codeTranslations)
  .pick({
    sourceLanguage: true,
    targetLanguage: true,
    sourceCode: true,
  })
  .extend({
    aiProvider: z.string().optional().default("grok"),
  });

export const insertBeatPatternSchema = createInsertSchema(beatPatterns).pick({
  name: true,
  pattern: true,
  bpm: true,
});

export const insertMelodySchema = createInsertSchema(melodies).pick({
  name: true,
  notes: true,
  scale: true,
});

export const insertVulnerabilityScanSchema = createInsertSchema(
  vulnerabilityScans,
)
  .pick({
    code: true,
    language: true,
  })
  .extend({
    aiProvider: z.string().optional().default("grok"),
  });

export const songs = pgTable("songs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  originalUrl: varchar("original_url").notNull(),
  accessibleUrl: varchar("accessible_url").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration"), // in seconds
  format: varchar("format"), // wav, mp3, m4a, etc.
  uploadDate: timestamp("upload_date").defaultNow(),
  lastPlayed: timestamp("last_played"),
  playCount: integer("play_count").default(0),
  // Analysis data
  estimatedBPM: integer("estimated_bpm"),
  keySignature: varchar("key_signature"),
  genre: varchar("genre"),
  mood: varchar("mood"),
  structure: jsonb("structure"), // song sections with timings
  instruments: text("instruments").array(),
  analysisNotes: text("analysis_notes"),
  analyzedAt: timestamp("analyzed_at"),
});

export const playlists = pgTable("playlists", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const playlistSongs = pgTable("playlist_songs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").references(() => playlists.id, {
    onDelete: "cascade",
  }),
  songId: varchar("song_id").references(() => songs.id, {
    onDelete: "cascade",
  }),
  position: integer("position").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const samplePacks = pgTable("sample_packs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  mood: text("mood").notNull(),
  description: text("description"),
  generatedSamples: json("generated_samples").notNull(), // Array of sample objects
  createdAt: timestamp("created_at").defaultNow(),
});

export const samples = pgTable("samples", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  packId: varchar("pack_id").references(() => samplePacks.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "drums", "bass", "melody", "vocals"
  category: text("category").notNull(), // "kick", "snare", "hihat", "808", etc.
  audioData: text("audio_data").notNull(), // Base64 encoded audio
  description: text("description"),
  bpm: integer("bpm"),
  key: text("key"),
  duration: integer("duration"), // in milliseconds
  aiData: json("ai_data"), // AI-generated musical data
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLyricsSchema = createInsertSchema(lyrics).pick({
  title: true,
  content: true,
  genre: true,
  rhymeScheme: true,
});

export const insertSongSchema = createInsertSchema(songs).pick({
  name: true,
  originalUrl: true,
  accessibleUrl: true,
  fileSize: true,
  duration: true,
  format: true,
});

export const insertPlaylistSchema = createInsertSchema(playlists).pick({
  name: true,
  description: true,
  isPublic: true,
});

export const insertSamplePackSchema = createInsertSchema(samplePacks).pick({
  name: true,
  genre: true,
  mood: true,
  description: true,
  generatedSamples: true,
});

export const insertSampleSchema = createInsertSchema(samples).pick({
  packId: true,
  name: true,
  type: true,
  category: true,
  audioData: true,
  description: true,
  bpm: true,
  key: true,
  duration: true,
  aiData: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type CodeTranslation = typeof codeTranslations.$inferSelect;
export type InsertCodeTranslation = z.infer<typeof insertCodeTranslationSchema>;
export type BeatPattern = typeof beatPatterns.$inferSelect;
export type InsertBeatPattern = z.infer<typeof insertBeatPatternSchema>;
export type Melody = typeof melodies.$inferSelect;
export type InsertMelody = z.infer<typeof insertMelodySchema>;
export type VulnerabilityScan = typeof vulnerabilityScans.$inferSelect;
export type InsertVulnerabilityScan = z.infer<
  typeof insertVulnerabilityScanSchema
>;
export type Lyrics = typeof lyrics.$inferSelect;
export type InsertLyrics = z.infer<typeof insertLyricsSchema>;
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type PlaylistSong = typeof playlistSongs.$inferSelect;
export type SamplePack = typeof samplePacks.$inferSelect;
export type InsertSamplePack = z.infer<typeof insertSamplePackSchema>;
export type Sample = typeof samples.$inferSelect;
export type InsertSample = z.infer<typeof insertSampleSchema>;
