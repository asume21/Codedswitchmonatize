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
  password: text("password").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, inactive, canceled, past_due
  subscriptionTier: text("subscription_tier").default("free"), // free, basic, pro
  // Activation key system for premium access
  activationKey: text("activation_key").unique(), // Generated after payment
  activatedAt: timestamp("activated_at"), // When key was first used
  // Usage tracking for sustainable freemium model
  monthlyUploads: integer("monthly_uploads").default(0),
  monthlyGenerations: integer("monthly_generations").default(0),
  lastUsageReset: timestamp("last_usage_reset").defaultNow(),
  // Credit system for AI generation
  credits: integer("credits").default(10), // Free credits on signup
  totalCreditsSpent: integer("total_credits_spent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(), // positive for credit, negative for debit
  type: text("type").notNull(), // purchase, deduction, refund, subscription_grant, bonus, admin_adjustment
  reason: text("reason").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  metadata: json("metadata"), // additional info like package type, payment intent ID, etc.
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
  password: true,
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
  // Social sharing
  isPublic: boolean("is_public").default(false),
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
  packId: varchar("pack_id"), // Can be null for individual samples
  name: varchar("name").notNull(),
  key: varchar("key"), // musical key
  bpm: integer("bpm"),
  duration: integer("duration"), // in seconds
  description: text("description"),
  aiData: jsonb("ai_data"), // AI-generated metadata
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  displayName: varchar("display_name"),
  bio: text("bio"),
  avatarUrl: varchar("avatar_url"),
  websiteUrl: varchar("website_url"),
  socialLinks: jsonb("social_links"), // { twitter, instagram, youtube, etc. }
  location: varchar("location"),
  favoriteGenres: text("favorite_genres").array(),
  instruments: text("instruments").array(),
  skillLevel: varchar("skill_level"), // beginner, intermediate, advanced, professional
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectShares = pgTable("project_shares", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  sharedByUserId: varchar("shared_by_user_id").references(() => users.id),
  sharedWithUserId: varchar("shared_with_user_id").references(() => users.id),
  permission: varchar("permission").default("view"), // view, edit, admin
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectCollaborations = pgTable("project_collaborations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  role: varchar("role").default("collaborator"), // owner, collaborator, viewer
  joinedAt: timestamp("joined_at").defaultNow(),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
});

export const projectComments = pgTable("project_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  content: text("content").notNull(),
  parentCommentId: varchar("parent_comment_id"), // for replies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectLikes = pgTable("project_likes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userFollows = pgTable("user_follows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id),
  followingId: varchar("following_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectVersions = pgTable("project_versions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  version: integer("version").notNull(),
  data: jsonb("data").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  changeDescription: text("change_description"),
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

export const insertSampleSchema = createInsertSchema(samples).pick({
  packId: true,
  name: true,
  key: true,
  bpm: true,
  duration: true,
  description: true,
  aiData: true,
});

export const insertSamplePackSchema = createInsertSchema(samplePacks).pick({
  name: true,
  genre: true,
  mood: true,
  description: true,
  generatedSamples: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).pick({
  displayName: true,
  bio: true,
  avatarUrl: true,
  websiteUrl: true,
  socialLinks: true,
  location: true,
  favoriteGenres: true,
  instruments: true,
  skillLevel: true,
});

export const insertProjectShareSchema = createInsertSchema(projectShares).pick({
  permission: true,
});

export const insertProjectCollaborationSchema = createInsertSchema(projectCollaborations).pick({
  role: true,
});

export const insertProjectCommentSchema = createInsertSchema(projectComments).pick({
  content: true,
  parentCommentId: true,
});

export const insertProjectLikeSchema = createInsertSchema(projectLikes);

export const insertUserFollowSchema = createInsertSchema(userFollows);

export const insertProjectVersionSchema = createInsertSchema(projectVersions).pick({
  version: true,
  data: true,
  changeDescription: true,
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserFollow = typeof userFollows.$inferSelect;
export type ProjectShare = typeof projectShares.$inferSelect;
export type ProjectCollaboration = typeof projectCollaborations.$inferSelect;
export type ProjectComment = typeof projectComments.$inferSelect;
export type ProjectLike = typeof projectLikes.$inferSelect;
export type ProjectVersion = typeof projectVersions.$inferSelect;

// Basic table inferred types
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
export type InsertVulnerabilityScan = z.infer<typeof insertVulnerabilityScanSchema>;
export type Lyrics = typeof lyrics.$inferSelect;
export type InsertLyrics = z.infer<typeof insertLyricsSchema>;
export type Song = typeof songs.$inferSelect;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type PlaylistSong = typeof playlistSongs.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;
export type SamplePack = typeof samplePacks.$inferSelect;
export type InsertSamplePack = z.infer<typeof insertSamplePackSchema>;
export type Sample = typeof samples.$inferSelect;
export type InsertSample = z.infer<typeof insertSampleSchema>;

// AI Recommendation System for Song Analysis
export enum RecommendationCategory {
  MIX_BALANCE = "mix_balance",
  VOCAL_EFFECTS = "vocal_effects",
  TEMPO = "tempo",
  MELODY = "melody",
  LYRICS = "lyrics",
  STRUCTURE = "structure",
  PRODUCTION = "production",
  INSTRUMENTATION = "instrumentation",
}

export enum ToolTarget {
  MIX_STUDIO = "mix-studio",
  BEAT_STUDIO = "beat-studio",
  PIANO_ROLL = "piano-roll",
  LYRICS_LAB = "lyrics-lab",
  UNIFIED_STUDIO = "unified-studio",
}

export const recommendationSchema = z.object({
  id: z.string(),
  message: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  category: z.nativeEnum(RecommendationCategory),
  targetTool: z.nativeEnum(ToolTarget),
  navigationPayload: z.object({
    trackId: z.string().optional(),
    action: z.string().optional(),
    params: z.record(z.any()).optional(),
  }).optional(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;
