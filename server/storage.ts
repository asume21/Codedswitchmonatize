import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type CodeTranslation,
  type InsertCodeTranslation,
  type BeatPattern,
  type InsertBeatPattern,
  type Melody,
  type InsertMelody,
  type VulnerabilityScan,
  type InsertVulnerabilityScan,
  type Lyrics,
  type InsertLyrics,
  type Song,
  type InsertSong,
  type Playlist,
  type InsertPlaylist,
  type PlaylistSong,
  type SamplePack,
  type InsertSamplePack,
  type Sample,
  type InsertSample,
  type LyricsAnalysis,
  type InsertLyricsAnalysis,
  type CreditTransaction,
  type InsertCreditTransaction,
  type UserSubscription,
  type InsertUserSubscription,
  type Track,
  type InsertTrack,
  type JamSession,
  type InsertJamSession,
  type JamContribution,
  type InsertJamContribution,
  type JamLike,
  type UserProfile,
  type UserFollow,
  type ProjectShare,
  type VoiceConvertJob,
  type InsertVoiceConvertJob,
  type UserApiKey,
  type WebearApiKey,
  type InsertUserApiKey,
  type SocialPost,
  type SocialConnection,
  type ChatMessage,
  type CollabInvite,
  type InsertCollabInvite,
  type BlogPost,
  type InsertBlogPost,
  users,
  userSubscriptions,
  projects,
  codeTranslations,
  beatPatterns,
  melodies,
  vulnerabilityScans,
  lyrics,
  songs,
  playlists,
  playlistSongs,
  samplePacks,
  samples,
  lyricsAnalyses,
  creditTransactions,
  tracks,
  jamSessions,
  jamContributions,
  jamLikes,
  userProfiles,
  userFollows,
  projectShares,
  voiceConvertJobs,
  userApiKeys,
  webearApiKeys,
  socialPosts,
  socialConnections,
  chatMessages,
  collabInvites,
  blogPosts,
} from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";
import { db } from "./db";
import { eq, desc, sql, and, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateUserStripeInfo(
    userId: string,
    data: {
      customerId?: string;
      subscriptionId?: string;
      status?: string;
      tier?: string;
    },
  ): Promise<User>;
  updateUserUsage(userId: string, uploads: number, generations: number): Promise<User>;
  incrementUserUsage(userId: string, type: 'uploads' | 'generations'): Promise<User>;
  updateUserCredits(userId: string, creditsDelta: number): Promise<User>;
  atomicDeductCredits(userId: string, amount: number): Promise<User>;
  updateUser(userId: string, data: Partial<User>): Promise<User>;
  getUserByActivationKey(activationKey: string): Promise<User | undefined>;
  activateUserKey(userId: string): Promise<User>;
  setUserActivationKey(userId: string, activationKey: string): Promise<User>;
  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  upsertUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription>;
  updateSubscriptionStatusByStripeId(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodEnd?: Date | null,
  ): Promise<UserSubscription | undefined>;
  
  // Credit Transactions
  logCreditTransaction(transaction: any): Promise<void>;
  getCreditTransactions(userId: string, limit: number, offset: number): Promise<any[]>;
  getCreditTransaction(transactionId: string): Promise<any | undefined>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getUserProjects(userId: string): Promise<Project[]>;
  createProject(userId: string, project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Code Translations
  getCodeTranslation(id: string): Promise<CodeTranslation | undefined>;
  getUserCodeTranslations(userId: string): Promise<CodeTranslation[]>;
  createCodeTranslation(
    userId: string,
    translation: InsertCodeTranslation & { translatedCode: string },
  ): Promise<CodeTranslation>;

  // Beat Patterns
  getBeatPattern(id: string): Promise<BeatPattern | undefined>;
  getUserBeatPatterns(userId: string): Promise<BeatPattern[]>;
  createBeatPattern(
    userId: string,
    pattern: InsertBeatPattern,
  ): Promise<BeatPattern>;

  // Melodies
  getMelody(id: string): Promise<Melody | undefined>;
  getUserMelodies(userId: string): Promise<Melody[]>;
  createMelody(userId: string, melody: InsertMelody): Promise<Melody>;

  // Vulnerability Scans
  getVulnerabilityScan(id: string): Promise<VulnerabilityScan | undefined>;
  getUserVulnerabilityScans(userId: string): Promise<VulnerabilityScan[]>;
  createVulnerabilityScan(
    userId: string,
    scan: InsertVulnerabilityScan & { results: any },
  ): Promise<VulnerabilityScan>;

  // Lyrics
  getLyrics(id: string): Promise<Lyrics | undefined>;
  getUserLyrics(userId: string): Promise<Lyrics[]>;
  createLyrics(userId: string, lyrics: InsertLyrics): Promise<Lyrics>;
  saveLyricsAnalysis(userId: string, analysis: InsertLyricsAnalysis): Promise<LyricsAnalysis>;
  getLyricsAnalysesBySong(songId: string): Promise<LyricsAnalysis[]>;

  // Songs
  getSong(id: string): Promise<Song | undefined>;
  getUserSongs(userId: string): Promise<Song[]>;
  createSong(userId: string, song: InsertSong): Promise<Song>;
  updateSong(id: string, data: Partial<Song>): Promise<Song>;
  deleteSong(id: string): Promise<void>;
  updateSongPlayStats(id: string): Promise<void>;
  updateSongAnalysis(
    id: string,
    analysis: {
      estimatedBPM?: number;
      keySignature?: string;
      genre?: string;
      mood?: string;
      structure?: any;
      instruments?: string[];
      analysisNotes?: string;
    },
  ): Promise<Song>;
  updateSongTranscription(
    songId: string,
    userId: string,
    data: {
      transcription?: string;
      transcriptionStatus?: string;
      transcribedAt?: Date;
    },
  ): Promise<Song>;

  // Playlists
  getPlaylist(id: string): Promise<Playlist | undefined>;
  getUserPlaylists(userId: string): Promise<Playlist[]>;
  createPlaylist(userId: string, playlist: InsertPlaylist): Promise<Playlist>;
  updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  addSongToPlaylist(playlistId: string, songId: string): Promise<PlaylistSong>;
  removeSongFromPlaylist(playlistId: string, songId: string): Promise<void>;
  getPlaylistSongs(
    playlistId: string,
  ): Promise<(PlaylistSong & { song: Song })[]>;

  // Sample Packs
  getSamplePack(id: string): Promise<SamplePack | undefined>;
  getSamplePacks(limit?: number, offset?: number): Promise<SamplePack[]>;
  createSamplePack(pack: InsertSamplePack): Promise<SamplePack>;
  deleteSamplePack(id: string): Promise<void>;

  // Samples
  getSample(id: string): Promise<Sample | undefined>;
  getAllSamples(limit?: number, offset?: number): Promise<Sample[]>;
  getSamplesByPack(packId: string): Promise<Sample[]>;
  createSample(sample: InsertSample): Promise<Sample>;
  deleteSample(id: string): Promise<void>;

  // Tracks - Single source of truth for all audio in arrangements
  getTrack(id: string): Promise<Track | undefined>;
  getProjectTracks(projectId: string): Promise<Track[]>;
  getUserTracks(userId: string): Promise<Track[]>;
  createTrack(userId: string, projectId: string | null, track: InsertTrack): Promise<Track>;
  updateTrack(id: string, data: Partial<Track>): Promise<Track>;
  deleteTrack(id: string): Promise<void>;
  deleteProjectTracks(projectId: string): Promise<void>;

  // Jam Sessions
  getJamSession(id: string): Promise<JamSession | undefined>;
  getActiveJamSessions(): Promise<JamSession[]>;
  getUserJamSessions(userId: string): Promise<JamSession[]>;
  createJamSession(hostId: string, session: InsertJamSession): Promise<JamSession>;
  updateJamSession(id: string, data: Partial<JamSession>): Promise<JamSession>;
  endJamSession(id: string): Promise<JamSession>;

  // Jam Contributions
  getJamContributions(sessionId: string): Promise<JamContribution[]>;
  createJamContribution(sessionId: string, userId: string, contribution: InsertJamContribution): Promise<JamContribution>;

  // Jam Likes
  addJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<JamLike>;
  removeJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<void>;

  // Social Features - User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;

  // Social Features - Follows
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isUserFollowing(followerId: string, followingId: string): Promise<boolean>;
  getUserFollowersCount(userId: string): Promise<number>;
  getUserFollowingCount(userId: string): Promise<number>;
  getUserFollowers(userId: string): Promise<any[]>;
  getUserFollowing(userId: string): Promise<any[]>;

  // Social Features - Project Shares
  createProjectShare(projectId: string, sharedByUserId: string, sharedWithUserId: string, permission?: string): Promise<ProjectShare>;
  getProjectShares(projectId: string): Promise<ProjectShare[]>;
  getUserSharedProjects(userId: string): Promise<ProjectShare[]>;

  // Social Features - Posts & Feed
  getSocialFeed(userId: string): Promise<any[]>;
  getPublicOrganismFeed(limit: number): Promise<any[]>;
  createSocialPost(userId: string, data: any): Promise<any>;
  createSocialConnection(userId: string, data: any): Promise<any>;
  getUserSocialConnections(userId: string): Promise<any[]>;
  disconnectSocialPlatform(userId: string, platform: string): Promise<void>;

  // Chat Messages
  sendChatMessage(senderId: string, recipientId: string, content: string, messageType?: string, attachmentUrl?: string): Promise<any>;
  getChatConversation(userId1: string, userId2: string, limit?: number): Promise<any[]>;
  getUserConversations(userId: string): Promise<any[]>;
  markMessagesRead(userId: string, conversationId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;

  // Discover Users
  discoverUsers(userId: string, limit?: number): Promise<any[]>;

  // Collab Invites
  createCollabInvite(data: InsertCollabInvite): Promise<CollabInvite>;
  getCollabInvite(id: number): Promise<CollabInvite | undefined>;
  getUserPendingInvites(userId: string): Promise<any[]>;
  getUserSentInvites(userId: string): Promise<any[]>;
  updateCollabInviteStatus(id: number, status: string): Promise<CollabInvite>;
  getInviteCount(userId: string): Promise<number>;

  // Voice Convert Jobs
  createVoiceConvertJob(userId: string, data: InsertVoiceConvertJob): Promise<VoiceConvertJob>;
  getVoiceConvertJob(id: string): Promise<VoiceConvertJob | undefined>;
  getUserVoiceConvertJobs(userId: string, limit?: number): Promise<VoiceConvertJob[]>;
  updateVoiceConvertJob(id: string, data: Partial<VoiceConvertJob>): Promise<VoiceConvertJob>;

  // User API Keys
  getUserApiKeys(userId: string): Promise<UserApiKey[]>;
  getUserApiKey(userId: string, service: string): Promise<UserApiKey | undefined>;
  upsertUserApiKey(userId: string, data: InsertUserApiKey): Promise<UserApiKey>;
  deleteUserApiKey(userId: string, service: string): Promise<void>;

  // WebEar API Keys
  getWebearKeyByValue(key: string): Promise<WebearApiKey | undefined>;
  getWebearKeyByUserId(userId: string): Promise<WebearApiKey | undefined>;
  createWebearKey(userId: string): Promise<WebearApiKey>;
  revokeWebearKey(userId: string): Promise<void>;
  incrementWebearKeyUsage(keyId: string): Promise<void>;

  // Blog Posts
  createBlogPost(userId: string, data: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(postId: string, data: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(postId: string): Promise<void>;
  getBlogPost(id: string): Promise<BlogPost | null>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | null>;
  getUserBlogPosts(userId: string): Promise<BlogPost[]>;
  getPublishedBlogPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  getRelatedBlogPosts(category: string, excludeSlug: string): Promise<BlogPost[]>;
  incrementBlogPostViews(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private codeTranslations: Map<string, CodeTranslation>;
  private beatPatterns: Map<string, BeatPattern>;
  private melodies: Map<string, Melody>;
  private vulnerabilityScans: Map<string, VulnerabilityScan>;
  private lyrics: Map<string, Lyrics>;
  private lyricsAnalyses: Map<string, LyricsAnalysis>;
  private songs: Map<string, Song>;
  private playlists: Map<string, Playlist>;
  private playlistSongs: Map<string, PlaylistSong>;
  private samplePacks: Map<string, SamplePack>;
  private samples: Map<string, Sample>;
  private creditTransactions: Map<string, CreditTransaction>;
  private subscriptions: Map<string, UserSubscription>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.codeTranslations = new Map();
    this.beatPatterns = new Map();
    this.melodies = new Map();
    this.vulnerabilityScans = new Map();
    this.lyrics = new Map();
    this.lyricsAnalyses = new Map();
    this.songs = new Map();
    this.playlists = new Map();
    this.playlistSongs = new Map();
    this.samplePacks = new Map();
    this.samples = new Map();
    this.creditTransactions = new Map();
    this.subscriptions = new Map();

    // Create default user
    const defaultUser: User = {
      id: "default-user",
      username: "CodeTuneUser",
      email: "user@codetune.studio",
      password: "default-password-not-used",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionTier: "free",
      activationKey: null,
      activatedAt: null,
      monthlyUploads: 0,
      monthlyGenerations: 0,
      lastUsageReset: new Date(),
      credits: 10, // Free credits on signup
      totalCreditsSpent: 0,
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);

    // Default subscription state (free tier)
    this.subscriptions.set(defaultUser.id, {
      id: 1,
      userId: defaultUser.id,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: "free",
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.stripeCustomerId === customerId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionTier: "free",
      activationKey: null,
      activatedAt: null,
      monthlyUploads: 0,
      monthlyGenerations: 0,
      lastUsageReset: new Date(),
      credits: 10, // Free credits on signup
      totalCreditsSpent: 0,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateStripeCustomerId(
    userId: string,
    customerId: string,
  ): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      stripeCustomerId: customerId,
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserStripeInfo(
    userId: string,
    data: {
      customerId?: string;
      subscriptionId?: string;
      status?: string;
      tier?: string;
    },
  ): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      ...(data.customerId && { stripeCustomerId: data.customerId }),
      ...(data.subscriptionId && { stripeSubscriptionId: data.subscriptionId }),
      ...(data.status && { subscriptionStatus: data.status }),
      ...(data.tier && { subscriptionTier: data.tier }),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserUsage(userId: string, uploads: number, generations: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      monthlyUploads: uploads,
      monthlyGenerations: generations,
      lastUsageReset: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async incrementUserUsage(userId: string, type: 'uploads' | 'generations'): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      monthlyUploads: type === 'uploads' ? (user.monthlyUploads || 0) + 1 : (user.monthlyUploads || 0),
      monthlyGenerations: type === 'generations' ? (user.monthlyGenerations || 0) + 1 : (user.monthlyGenerations || 0),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserCredits(userId: string, creditsDelta: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      credits: Math.max(0, (user.credits || 10) + creditsDelta),
      totalCreditsSpent: (user.totalCreditsSpent || 0) + Math.abs(creditsDelta),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async atomicDeductCredits(userId: string, amount: number): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const balance = user.credits || 0;
    if (balance < amount) throw new Error(`Insufficient credits. Need ${amount}, have ${balance}`);
    const updated: User = {
      ...user,
      credits: balance - amount,
      totalCreditsSpent: (user.totalCreditsSpent || 0) + amount,
    };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = { ...user, ...data };
    this.users.set(userId, updated);
    return updated;
  }

  async getUserByActivationKey(activationKey: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.activationKey === activationKey
    );
  }

  async activateUserKey(userId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      activatedAt: new Date(),
    };
    this.users.set(userId, updated);
    return updated;
  }

  async setUserActivationKey(userId: string, activationKey: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");

    const updated: User = {
      ...user,
      activationKey,
    };
    this.users.set(userId, updated);
    return updated;
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    return this.subscriptions.get(userId);
  }

  async upsertUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const existing = this.subscriptions.get(subscription.userId);
    const now = new Date();
    const record: UserSubscription = {
      id: existing?.id ?? this.subscriptions.size + 1,
      userId: subscription.userId,
      stripeCustomerId: subscription.stripeCustomerId ?? existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: subscription.stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
      status: subscription.status ?? existing?.status ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.userId, record);
    return record;
  }

  async updateSubscriptionStatusByStripeId(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodEnd?: Date | null,
  ): Promise<UserSubscription | undefined> {
    const entry = Array.from(this.subscriptions.values()).find(
      (sub) => sub.stripeSubscriptionId === stripeSubscriptionId,
    );
    if (!entry) return undefined;

    const updated: UserSubscription = {
      ...entry,
      status,
      currentPeriodEnd: currentPeriodEnd ?? entry.currentPeriodEnd ?? null,
      updatedAt: new Date(),
    };
    this.subscriptions.set(entry.userId, updated);
    return updated;
  }

  // Credit Transactions
  async logCreditTransaction(transaction: CreditTransaction): Promise<void> {
    this.creditTransactions.set(transaction.id, transaction);
  }

  async getCreditTransactions(userId: string, limit: number, offset: number): Promise<CreditTransaction[]> {
    const userTransactions = Array.from(this.creditTransactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(offset, offset + limit);
    return userTransactions;
  }

  async getCreditTransaction(transactionId: string): Promise<CreditTransaction | undefined> {
    return this.creditTransactions.get(transactionId);
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(
      (project) => project.userId === userId,
    );
  }

  async createProject(
    userId: string,
    insertProject: InsertProject,
  ): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) throw new Error("Project not found");

    const updated: Project = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  // Code Translations
  async getCodeTranslation(id: string): Promise<CodeTranslation | undefined> {
    return this.codeTranslations.get(id);
  }

  async getUserCodeTranslations(userId: string): Promise<CodeTranslation[]> {
    return Array.from(this.codeTranslations.values()).filter(
      (translation) => translation.userId === userId,
    );
  }

  async createCodeTranslation(
    userId: string,
    data: InsertCodeTranslation & { translatedCode: string },
  ): Promise<CodeTranslation> {
    const id = randomUUID();
    const translation: CodeTranslation = {
      ...data,
      id,
      userId,
      createdAt: new Date(),
    };
    this.codeTranslations.set(id, translation);
    return translation;
  }

  // Beat Patterns
  async getBeatPattern(id: string): Promise<BeatPattern | undefined> {
    return this.beatPatterns.get(id);
  }

  async getUserBeatPatterns(userId: string): Promise<BeatPattern[]> {
    return Array.from(this.beatPatterns.values()).filter(
      (pattern) => pattern.userId === userId,
    );
  }

  async createBeatPattern(
    userId: string,
    insertPattern: InsertBeatPattern,
  ): Promise<BeatPattern> {
    const id = randomUUID();
    const pattern: BeatPattern = {
      ...insertPattern,
      id,
      userId,
      createdAt: new Date(),
    };
    this.beatPatterns.set(id, pattern);
    return pattern;
  }

  // Melodies
  async getMelody(id: string): Promise<Melody | undefined> {
    return this.melodies.get(id);
  }

  async getUserMelodies(userId: string): Promise<Melody[]> {
    return Array.from(this.melodies.values()).filter(
      (melody) => melody.userId === userId,
    );
  }

  async createMelody(
    userId: string,
    insertMelody: InsertMelody,
  ): Promise<Melody> {
    const id = randomUUID();
    const melody: Melody = {
      ...insertMelody,
      id,
      userId,
      createdAt: new Date(),
    };
    this.melodies.set(id, melody);
    return melody;
  }

  // Vulnerability Scans
  async getVulnerabilityScan(
    id: string,
  ): Promise<VulnerabilityScan | undefined> {
    return this.vulnerabilityScans.get(id);
  }

  async getUserVulnerabilityScans(
    userId: string,
  ): Promise<VulnerabilityScan[]> {
    return Array.from(this.vulnerabilityScans.values()).filter(
      (scan) => scan.userId === userId,
    );
  }

  async createVulnerabilityScan(
    userId: string,
    data: InsertVulnerabilityScan & { results: any },
  ): Promise<VulnerabilityScan> {
    const id = randomUUID();
    const scan: VulnerabilityScan = {
      ...data,
      id,
      userId,
      createdAt: new Date(),
    };
    this.vulnerabilityScans.set(id, scan);
    return scan;
  }

  // Lyrics
  async getLyrics(id: string): Promise<Lyrics | undefined> {
    return this.lyrics.get(id);
  }

  async getUserLyrics(userId: string): Promise<Lyrics[]> {
    return Array.from(this.lyrics.values()).filter(
      (lyrics) => lyrics.userId === userId,
    );
  }

  async createLyrics(
    userId: string,
    insertLyrics: InsertLyrics,
  ): Promise<Lyrics> {
    const id = randomUUID();
    const lyrics: Lyrics = {
      ...insertLyrics,
      id,
      userId,
      genre: insertLyrics.genre || null,
      rhymeScheme: insertLyrics.rhymeScheme || null,
      createdAt: new Date(),
    };
    this.lyrics.set(id, lyrics);
    return lyrics;
  }

  async saveLyricsAnalysis(
    userId: string,
    analysis: InsertLyricsAnalysis,
  ): Promise<LyricsAnalysis> {
    const id = (analysis as any).id || randomUUID();
    const record: LyricsAnalysis = {
      id,
      content: analysis.content,
      userId,
      songId: analysis.songId ?? null,
      lyricsId: analysis.lyricsId ?? null,
      analysis: analysis.analysis ?? null,
      createdAt: new Date(),
    };
    this.lyricsAnalyses.set(id, record);
    return record;
  }

  async getLyricsAnalysesBySong(songId: string): Promise<LyricsAnalysis[]> {
    return Array.from(this.lyricsAnalyses.values()).filter(
      (item) => item.songId === songId,
    );
  }

  // Songs
  async getSong(id: string): Promise<Song | undefined> {
    return this.songs.get(id);
  }

  async getUserSongs(userId: string): Promise<Song[]> {
    return Array.from(this.songs.values()).filter(
      (song) => song.userId === userId,
    );
  }

  async createSong(userId: string, insertSong: InsertSong): Promise<Song> {
    const id = randomUUID();
    const song: Song = {
      ...insertSong,
      id,
      userId,
      duration: insertSong.duration || null,
      format: insertSong.format || null,
      uploadDate: new Date(),
      lastPlayed: null,
      playCount: 0,
      estimatedBPM: null,
      keySignature: null,
      genre: null,
      mood: null,
      structure: null,
      instruments: null,
      analysisNotes: null,
      analyzedAt: null,
      isPublic: false,
      audioData: insertSong.audioData || null,
      mimeType: insertSong.mimeType || null,
      transcription: null,
      transcriptionStatus: null,
      transcribedAt: null,
    };
    this.songs.set(id, song);
    return song;
  }

  async updateSong(id: string, data: Partial<Song>): Promise<Song> {
    const song = this.songs.get(id);
    if (!song) throw new Error("Song not found");
    const updated = { ...song, ...data };
    this.songs.set(id, updated);
    return updated;
  }

  async deleteSong(id: string): Promise<void> {
    this.songs.delete(id);
  }

  async updateSongPlayStats(id: string): Promise<void> {
    const song = this.songs.get(id);
    if (song) {
      song.lastPlayed = new Date();
      song.playCount = (song.playCount || 0) + 1;
      this.songs.set(id, song);
    }
  }

  async updateSongAnalysis(
    id: string,
    analysis: {
      estimatedBPM?: number;
      keySignature?: string;
      genre?: string;
      mood?: string;
      structure?: any;
      instruments?: string[];
      analysisNotes?: string;
    },
  ): Promise<Song> {
    const song = this.songs.get(id);
    if (!song) throw new Error("Song not found");
    const updated = {
      ...song,
      ...analysis,
      analyzedAt: new Date(),
    };
    this.songs.set(id, updated);
    return updated;
  }

  async updateSongTranscription(
    songId: string,
    userId: string,
    data: {
      transcription?: string;
      transcriptionStatus?: string;
      transcribedAt?: Date;
    },
  ): Promise<Song> {
    const song = this.songs.get(songId);
    if (!song) throw new Error("Song not found");
    if (song.userId !== userId) throw new Error("Access denied");
    const updated = {
      ...song,
      ...data,
    };
    this.songs.set(songId, updated);
    return updated;
  }

  // Playlists
  async getPlaylist(id: string): Promise<Playlist | undefined> {
    return this.playlists.get(id);
  }

  async getUserPlaylists(userId: string): Promise<Playlist[]> {
    return Array.from(this.playlists.values()).filter(
      (playlist) => playlist.userId === userId,
    );
  }

  async createPlaylist(
    userId: string,
    insertPlaylist: InsertPlaylist,
  ): Promise<Playlist> {
    const id = randomUUID();
    const playlist: Playlist = {
      ...insertPlaylist,
      id,
      userId,
      description: insertPlaylist.description || null,
      isPublic: insertPlaylist.isPublic || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.playlists.set(id, playlist);
    return playlist;
  }

  async updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist> {
    const playlist = this.playlists.get(id);
    if (!playlist) throw new Error("Playlist not found");
    const updated = { ...playlist, ...data, updatedAt: new Date() };
    this.playlists.set(id, updated);
    return updated;
  }

  async deletePlaylist(id: string): Promise<void> {
    this.playlists.delete(id);
    // Remove all playlist songs for this playlist
    Array.from(this.playlistSongs.values())
      .filter((ps) => ps.playlistId === id)
      .forEach((ps) => this.playlistSongs.delete(ps.id));
  }

  async addSongToPlaylist(
    playlistId: string,
    songId: string,
  ): Promise<PlaylistSong> {
    const id = randomUUID();
    // Get position as the highest position + 1
    const existingPlaylistSongs = Array.from(
      this.playlistSongs.values(),
    ).filter((ps) => ps.playlistId === playlistId);
    const position =
      existingPlaylistSongs.length > 0
        ? Math.max(...existingPlaylistSongs.map((ps) => ps.position)) + 1
        : 1;

    const playlistSong: PlaylistSong = {
      id,
      playlistId,
      songId,
      position,
      addedAt: new Date(),
    };
    this.playlistSongs.set(id, playlistSong);
    return playlistSong;
  }

  async removeSongFromPlaylist(
    playlistId: string,
    songId: string,
  ): Promise<void> {
    const playlistSong = Array.from(this.playlistSongs.values()).find(
      (ps) => ps.playlistId === playlistId && ps.songId === songId,
    );
    if (playlistSong) {
      this.playlistSongs.delete(playlistSong.id);
    }
  }

  async getPlaylistSongs(
    playlistId: string,
  ): Promise<(PlaylistSong & { song: Song })[]> {
    const playlistSongs = Array.from(this.playlistSongs.values())
      .filter((ps) => ps.playlistId === playlistId)
      .sort((a, b) => a.position - b.position);

    return playlistSongs
      .map((ps) => {
        const song = this.songs.get(ps.songId!);
        return song ? { ...ps, song } : null;
      })
      .filter(Boolean) as (PlaylistSong & { song: Song })[];
  }

  // Sample Packs
  async getSamplePack(id: string): Promise<SamplePack | undefined> {
    return this.samplePacks.get(id);
  }

  async getSamplePacks(limit = 100, offset = 0): Promise<SamplePack[]> {
    return Array.from(this.samplePacks.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .slice(offset, offset + limit);
  }

  async createSamplePack(pack: InsertSamplePack): Promise<SamplePack> {
    const id = randomUUID();
    const newPack: SamplePack = {
      id,
      ...pack,
      description: pack.description || null,
      createdAt: new Date(),
    };
    this.samplePacks.set(id, newPack);
    return newPack;
  }

  async deleteSamplePack(id: string): Promise<void> {
    this.samplePacks.delete(id);
    // Remove all samples in this pack
    Array.from(this.samples.values())
      .filter((s) => s.packId === id)
      .forEach((s) => this.samples.delete(s.id));
  }

  // Samples
  async getSample(id: string): Promise<Sample | undefined> {
    return this.samples.get(id);
  }

  async getAllSamples(limit = 100, offset = 0): Promise<Sample[]> {
    return Array.from(this.samples.values())
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .slice(offset, offset + limit);
  }

  async getSamplesByPack(packId: string): Promise<Sample[]> {
    return Array.from(this.samples.values())
      .filter((s) => s.packId === packId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createSample(sample: InsertSample): Promise<Sample> {
    const id = randomUUID();
    const newSample: Sample = {
      id,
      ...sample,
      key: sample.key || null,
      packId: sample.packId || null,
      bpm: sample.bpm || null,
      duration: sample.duration || null,
      description: sample.description || null,
      aiData: sample.aiData || null,
      createdAt: new Date(),
    };
    this.samples.set(id, newSample);
    return newSample;
  }

  async deleteSample(id: string): Promise<void> {
    this.samples.delete(id);
  }

  // Tracks - stub implementations for MemStorage (not persisted)
  private tracksMap: Map<string, Track> = new Map();
  private jamSessionsMap: Map<string, JamSession> = new Map();
  private jamContributionsMap: Map<string, JamContribution> = new Map();
  private jamLikesMap: Map<string, JamLike> = new Map();

  async getTrack(id: string): Promise<Track | undefined> {
    return this.tracksMap.get(id);
  }
  async getProjectTracks(projectId: string): Promise<Track[]> {
    return Array.from(this.tracksMap.values()).filter(t => t.projectId === projectId);
  }
  async getUserTracks(userId: string): Promise<Track[]> {
    return Array.from(this.tracksMap.values()).filter(t => t.userId === userId);
  }
  async createTrack(userId: string, projectId: string | null, track: InsertTrack): Promise<Track> {
    const id = randomUUID();
    const newTrack: Track = {
      id,
      userId,
      projectId,
      songId: null,
      name: track.name,
      type: track.type,
      audioUrl: track.audioUrl ?? null,
      position: track.position ?? 0,
      duration: track.duration ?? null,
      volume: track.volume ?? 100,
      pan: track.pan ?? 0,
      muted: track.muted ?? false,
      solo: track.solo ?? false,
      color: track.color ?? null,
      effects: track.effects ?? null,
      metadata: track.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tracksMap.set(id, newTrack);
    return newTrack;
  }
  async updateTrack(id: string, data: Partial<Track>): Promise<Track> {
    const existing = this.tracksMap.get(id);
    if (!existing) throw new Error("Track not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.tracksMap.set(id, updated);
    return updated;
  }
  async deleteTrack(id: string): Promise<void> {
    this.tracksMap.delete(id);
  }
  async deleteProjectTracks(projectId: string): Promise<void> {
    for (const [id, track] of this.tracksMap) {
      if (track.projectId === projectId) this.tracksMap.delete(id);
    }
  }

  // Jam Sessions - stub implementations
  async getJamSession(id: string): Promise<JamSession | undefined> {
    return this.jamSessionsMap.get(id);
  }
  async getActiveJamSessions(): Promise<JamSession[]> {
    return Array.from(this.jamSessionsMap.values()).filter(s => s.isActive);
  }
  async getUserJamSessions(userId: string): Promise<JamSession[]> {
    return Array.from(this.jamSessionsMap.values()).filter(s => s.hostId === userId);
  }
  async createJamSession(hostId: string, session: InsertJamSession): Promise<JamSession> {
    const id = randomUUID();
    const newSession: JamSession = {
      id,
      hostId,
      name: session.name,
      description: session.description ?? null,
      genre: session.genre ?? null,
      bpm: session.bpm ?? 120,
      keySignature: session.keySignature ?? null,
      isPublic: session.isPublic ?? true,
      isActive: true,
      maxParticipants: session.maxParticipants ?? 10,
      createdAt: new Date(),
      endedAt: null,
    };
    this.jamSessionsMap.set(id, newSession);
    return newSession;
  }
  async updateJamSession(id: string, data: Partial<JamSession>): Promise<JamSession> {
    const existing = this.jamSessionsMap.get(id);
    if (!existing) throw new Error("Jam session not found");
    const updated = { ...existing, ...data };
    this.jamSessionsMap.set(id, updated);
    return updated;
  }
  async endJamSession(id: string): Promise<JamSession> {
    return this.updateJamSession(id, { isActive: false, endedAt: new Date() });
  }

  // Jam Contributions
  async getJamContributions(sessionId: string): Promise<JamContribution[]> {
    return Array.from(this.jamContributionsMap.values()).filter(c => c.sessionId === sessionId);
  }
  async createJamContribution(sessionId: string, userId: string, contribution: InsertJamContribution): Promise<JamContribution> {
    const id = randomUUID();
    const newContribution: JamContribution = {
      id,
      sessionId,
      userId,
      trackId: null,
      type: contribution.type,
      audioUrl: contribution.audioUrl ?? null,
      position: contribution.position ?? 0,
      duration: contribution.duration ?? null,
      createdAt: new Date(),
    };
    this.jamContributionsMap.set(id, newContribution);
    return newContribution;
  }

  // Jam Likes
  async addJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<JamLike> {
    const id = randomUUID();
    const like: JamLike = { id, sessionId, contributionId, userId, createdAt: new Date() };
    this.jamLikesMap.set(id, like);
    return like;
  }
  async removeJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<void> {
    for (const [id, like] of this.jamLikesMap) {
      if (like.sessionId === sessionId && like.userId === userId && like.contributionId === contributionId) {
        this.jamLikesMap.delete(id);
      }
    }
  }

  // Social Features - MemStorage stubs (DatabaseStorage is used in production)
  async getUserProfile(_userId: string): Promise<UserProfile | undefined> { return undefined; }
  async createUserProfile(_userId: string, _data: Partial<UserProfile>): Promise<UserProfile> { throw new Error("Not implemented in MemStorage"); }
  async updateUserProfile(_userId: string, _data: Partial<UserProfile>): Promise<UserProfile> { throw new Error("Not implemented in MemStorage"); }
  async followUser(_followerId: string, _followingId: string): Promise<UserFollow> { throw new Error("Not implemented in MemStorage"); }
  async unfollowUser(_followerId: string, _followingId: string): Promise<void> { }
  async isUserFollowing(_followerId: string, _followingId: string): Promise<boolean> { return false; }
  async getUserFollowersCount(_userId: string): Promise<number> { return 0; }
  async getUserFollowingCount(_userId: string): Promise<number> { return 0; }
  async getUserFollowers(_userId: string): Promise<any[]> { return []; }
  async getUserFollowing(_userId: string): Promise<any[]> { return []; }
  async createProjectShare(_projectId: string, _sharedByUserId: string, _sharedWithUserId: string, _permission?: string): Promise<ProjectShare> { throw new Error("Not implemented in MemStorage"); }
  async getProjectShares(_projectId: string): Promise<ProjectShare[]> { return []; }
  async getUserSharedProjects(_userId: string): Promise<ProjectShare[]> { return []; }
  async getSocialFeed(_userId: string): Promise<any[]> { return []; }
  async getPublicOrganismFeed(_limit: number): Promise<any[]> { return []; }
  async createSocialPost(_userId: string, _data: any): Promise<any> { throw new Error("Not implemented in MemStorage"); }
  async createSocialConnection(_userId: string, _data: any): Promise<any> { throw new Error("Not implemented in MemStorage"); }
  async getUserSocialConnections(_userId: string): Promise<any[]> { return []; }
  async disconnectSocialPlatform(_userId: string, _platform: string): Promise<void> { }
  async sendChatMessage(_senderId: string, _recipientId: string, _content: string, _messageType?: string, _attachmentUrl?: string): Promise<any> { throw new Error("Not implemented in MemStorage"); }
  async getChatConversation(_userId1: string, _userId2: string, _limit?: number): Promise<any[]> { return []; }
  async getUserConversations(_userId: string): Promise<any[]> { return []; }
  async markMessagesRead(_userId: string, _conversationId: string): Promise<void> { }
  async getUnreadMessageCount(_userId: string): Promise<number> { return 0; }
  async discoverUsers(_userId: string, _limit?: number): Promise<any[]> { return []; }

  // Collab Invites (MemStorage stubs)
  async createCollabInvite(_data: InsertCollabInvite): Promise<CollabInvite> { throw new Error("Not implemented in MemStorage"); }
  async getCollabInvite(_id: number): Promise<CollabInvite | undefined> { return undefined; }
  async getUserPendingInvites(_userId: string): Promise<any[]> { return []; }
  async getUserSentInvites(_userId: string): Promise<any[]> { return []; }
  async updateCollabInviteStatus(_id: number, _status: string): Promise<CollabInvite> { throw new Error("Not implemented in MemStorage"); }
  async getInviteCount(_userId: string): Promise<number> { return 0; }

  // Voice Convert Jobs (MemStorage stubs)
  async createVoiceConvertJob(_userId: string, _data: InsertVoiceConvertJob): Promise<VoiceConvertJob> { throw new Error("Not implemented in MemStorage"); }
  async getVoiceConvertJob(_id: string): Promise<VoiceConvertJob | undefined> { return undefined; }
  async getUserVoiceConvertJobs(_userId: string, _limit?: number): Promise<VoiceConvertJob[]> { return []; }
  async updateVoiceConvertJob(_id: string, _data: Partial<VoiceConvertJob>): Promise<VoiceConvertJob> { throw new Error("Not implemented in MemStorage"); }

  // User API Keys (MemStorage stubs)
  async getUserApiKeys(_userId: string): Promise<UserApiKey[]> { return []; }
  async getUserApiKey(_userId: string, _service: string): Promise<UserApiKey | undefined> { return undefined; }
  async upsertUserApiKey(_userId: string, _data: InsertUserApiKey): Promise<UserApiKey> { throw new Error("Not implemented in MemStorage"); }
  async deleteUserApiKey(_userId: string, _service: string): Promise<void> {}

  // WebEar API Keys (MemStorage stubs)
  async getWebearKeyByValue(_key: string): Promise<WebearApiKey | undefined> { return undefined; }
  async getWebearKeyByUserId(_userId: string): Promise<WebearApiKey | undefined> { return undefined; }
  async createWebearKey(_userId: string): Promise<WebearApiKey> { throw new Error("Not implemented in MemStorage"); }
  async revokeWebearKey(_userId: string): Promise<void> {}
  async incrementWebearKeyUsage(_keyId: string): Promise<void> {}

  // Blog Posts (MemStorage stubs)
  private memBlogPosts: BlogPost[] = [];
  async createBlogPost(userId: string, data: InsertBlogPost): Promise<BlogPost> {
    const post: BlogPost = {
      id: randomUUID(),
      userId,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      tags: data.tags ?? null,
      imageUrl: data.imageUrl ?? null,
      isPublished: data.isPublished ?? false,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.memBlogPosts.push(post);
    return post;
  }
  async updateBlogPost(postId: string, data: Partial<InsertBlogPost>): Promise<BlogPost> {
    const idx = this.memBlogPosts.findIndex(p => p.id === postId);
    if (idx === -1) throw new Error("Blog post not found");
    this.memBlogPosts[idx] = { ...this.memBlogPosts[idx], ...data, updatedAt: new Date() };
    return this.memBlogPosts[idx];
  }
  async deleteBlogPost(postId: string): Promise<void> {
    this.memBlogPosts = this.memBlogPosts.filter(p => p.id !== postId);
  }
  async getBlogPost(id: string): Promise<BlogPost | null> {
    return this.memBlogPosts.find(p => p.id === id) ?? null;
  }
  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    return this.memBlogPosts.find(p => p.slug === slug) ?? null;
  }
  async getUserBlogPosts(userId: string): Promise<BlogPost[]> {
    return this.memBlogPosts.filter(p => p.userId === userId).sort((a, b) =>
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }
  async getPublishedBlogPosts(limit = 50, offset = 0): Promise<BlogPost[]> {
    return this.memBlogPosts
      .filter(p => p.isPublished)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(offset, offset + limit);
  }
  async getRelatedBlogPosts(category: string, excludeSlug: string): Promise<BlogPost[]> {
    return this.memBlogPosts
      .filter(p => p.category === category && p.slug !== excludeSlug && p.isPublished)
      .slice(0, 3);
  }
  async incrementBlogPostViews(id: string): Promise<void> {
    const post = this.memBlogPosts.find(p => p.id === id);
    if (post) post.views = (post.views ?? 0) + 1;
  }
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateStripeCustomerId(
    userId: string,
    customerId: string,
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    data: {
      customerId?: string;
      subscriptionId?: string;
      status?: string;
      tier?: string;
    },
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...(data.customerId && { stripeCustomerId: data.customerId }),
        ...(data.subscriptionId && {
          stripeSubscriptionId: data.subscriptionId,
        }),
        ...(data.status && { subscriptionStatus: data.status }),
        ...(data.tier && { subscriptionTier: data.tier }),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project || undefined;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId));
  }

  async createProject(
    userId: string,
    insertProject: InsertProject,
  ): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({ ...insertProject, userId })
      .returning();
    return project;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new Error("Project not found");
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Code Translations
  async getCodeTranslation(id: string): Promise<CodeTranslation | undefined> {
    const [translation] = await db
      .select()
      .from(codeTranslations)
      .where(eq(codeTranslations.id, id));
    return translation || undefined;
  }

  async getUserCodeTranslations(userId: string): Promise<CodeTranslation[]> {
    return await db
      .select()
      .from(codeTranslations)
      .where(eq(codeTranslations.userId, userId));
  }

  async createCodeTranslation(
    userId: string,
    data: InsertCodeTranslation & { translatedCode: string },
  ): Promise<CodeTranslation> {
    const [translation] = await db
      .insert(codeTranslations)
      .values({ ...data, userId })
      .returning();
    return translation;
  }

  // Beat Patterns
  async getBeatPattern(id: string): Promise<BeatPattern | undefined> {
    const [pattern] = await db
      .select()
      .from(beatPatterns)
      .where(eq(beatPatterns.id, id));
    return pattern || undefined;
  }

  async getUserBeatPatterns(userId: string): Promise<BeatPattern[]> {
    return await db
      .select()
      .from(beatPatterns)
      .where(eq(beatPatterns.userId, userId));
  }

  async createBeatPattern(
    userId: string,
    insertPattern: InsertBeatPattern,
  ): Promise<BeatPattern> {
    const [pattern] = await db
      .insert(beatPatterns)
      .values({ ...insertPattern, userId })
      .returning();
    return pattern;
  }

  // Melodies
  async getMelody(id: string): Promise<Melody | undefined> {
    const [melody] = await db
      .select()
      .from(melodies)
      .where(eq(melodies.id, id));
    return melody || undefined;
  }

  async getUserMelodies(userId: string): Promise<Melody[]> {
    return await db.select().from(melodies).where(eq(melodies.userId, userId));
  }

  async createMelody(
    userId: string,
    insertMelody: InsertMelody,
  ): Promise<Melody> {
    const [melody] = await db
      .insert(melodies)
      .values({ ...insertMelody, userId })
      .returning();
    return melody;
  }

  // Vulnerability Scans
  async getVulnerabilityScan(
    id: string,
  ): Promise<VulnerabilityScan | undefined> {
    const [scan] = await db
      .select()
      .from(vulnerabilityScans)
      .where(eq(vulnerabilityScans.id, id));
    return scan || undefined;
  }

  async getUserVulnerabilityScans(
    userId: string,
  ): Promise<VulnerabilityScan[]> {
    return await db
      .select()
      .from(vulnerabilityScans)
      .where(eq(vulnerabilityScans.userId, userId));
  }

  async createVulnerabilityScan(
    userId: string,
    data: InsertVulnerabilityScan & { results: any },
  ): Promise<VulnerabilityScan> {
    const [scan] = await db
      .insert(vulnerabilityScans)
      .values({ ...data, userId })
      .returning();
    return scan;
  }

  // Lyrics
  async getLyrics(id: string): Promise<Lyrics | undefined> {
    const [lyric] = await db.select().from(lyrics).where(eq(lyrics.id, id));
    return lyric || undefined;
  }

  async getUserLyrics(userId: string): Promise<Lyrics[]> {
    return await db.select().from(lyrics).where(eq(lyrics.userId, userId));
  }

  async createLyrics(
    userId: string,
    insertLyrics: InsertLyrics,
  ): Promise<Lyrics> {
    const [lyric] = await db
      .insert(lyrics)
      .values({
        ...insertLyrics,
        userId,
        genre: insertLyrics.genre || null,
        rhymeScheme: insertLyrics.rhymeScheme || null,
      })
      .returning();
    return lyric;
  }

  async saveLyricsAnalysis(
    userId: string,
    analysis: InsertLyricsAnalysis,
  ): Promise<LyricsAnalysis> {
    const [record] = await db
      .insert(lyricsAnalyses)
      .values({
        ...analysis,
        userId,
      })
      .returning();
    return record;
  }

  async getLyricsAnalysesBySong(songId: string): Promise<LyricsAnalysis[]> {
    return await db
      .select()
      .from(lyricsAnalyses)
      .where(eq(lyricsAnalyses.songId, songId));
  }

  // Songs
  async getSong(id: string): Promise<Song | undefined> {
    const [song] = await db.select().from(songs).where(eq(songs.id, id));
    return song || undefined;
  }

  async getUserSongs(userId: string): Promise<Song[]> {
    return await db.select().from(songs).where(eq(songs.userId, userId));
  }

  async createSong(userId: string, insertSong: InsertSong): Promise<Song> {
    const [song] = await db
      .insert(songs)
      .values({
        ...insertSong,
        userId,
        duration: insertSong.duration || null,
        format: insertSong.format || null,
        lastPlayed: null,
        playCount: 0,
        estimatedBPM: null,
        keySignature: null,
        genre: null,
        mood: null,
        structure: null,
        instruments: null,
        analysisNotes: null,
        analyzedAt: null,
        isPublic: false,
      })
      .returning();
    return song;
  }

  async updateSong(id: string, data: Partial<Song>): Promise<Song> {
    const [song] = await db
      .update(songs)
      .set(data)
      .where(eq(songs.id, id))
      .returning();
    if (!song) throw new Error("Song not found");
    return song;
  }

  async deleteSong(id: string): Promise<void> {
    await db.delete(songs).where(eq(songs.id, id));
  }

  async updateSongPlayStats(id: string): Promise<void> {
    await db
      .update(songs)
      .set({
        lastPlayed: new Date(),
        playCount: sql`${songs.playCount} + 1`,
      })
      .where(eq(songs.id, id));
  }

  async updateSongAnalysis(
    id: string,
    analysis: {
      estimatedBPM?: number;
      keySignature?: string;
      genre?: string;
      mood?: string;
      structure?: any;
      instruments?: string[];
      analysisNotes?: string;
    },
  ): Promise<Song> {
    const [song] = await db
      .update(songs)
      .set({
        ...analysis,
        analyzedAt: new Date(),
      })
      .where(eq(songs.id, id))
      .returning();
    if (!song) throw new Error("Song not found");
    return song;
  }

  async updateSongTranscription(
    songId: string,
    userId: string,
    data: {
      transcription?: string;
      transcriptionStatus?: string;
      transcribedAt?: Date;
    },
  ): Promise<Song> {
    // Verify ownership
    const [existing] = await db.select().from(songs).where(eq(songs.id, songId));
    if (!existing) throw new Error("Song not found");
    if (existing.userId !== userId) throw new Error("Access denied");
    
    const [song] = await db
      .update(songs)
      .set(data)
      .where(eq(songs.id, songId))
      .returning();
    if (!song) throw new Error("Song not found");
    return song;
  }

  // Playlists
  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, id));
    return playlist || undefined;
  }

  async getUserPlaylists(userId: string): Promise<Playlist[]> {
    return await db
      .select()
      .from(playlists)
      .where(eq(playlists.userId, userId));
  }

  async createPlaylist(
    userId: string,
    insertPlaylist: InsertPlaylist,
  ): Promise<Playlist> {
    const [playlist] = await db
      .insert(playlists)
      .values({
        ...insertPlaylist,
        userId,
        description: insertPlaylist.description || null,
        isPublic: insertPlaylist.isPublic || null,
      })
      .returning();
    return playlist;
  }

  async updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist> {
    const [playlist] = await db
      .update(playlists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playlists.id, id))
      .returning();
    if (!playlist) throw new Error("Playlist not found");
    return playlist;
  }

  async deletePlaylist(id: string): Promise<void> {
    // Remove all playlist songs for this playlist
    await db.delete(playlistSongs).where(eq(playlistSongs.playlistId, id));
    await db.delete(playlists).where(eq(playlists.id, id));
  }

  async addSongToPlaylist(
    playlistId: string,
    songId: string,
  ): Promise<PlaylistSong> {
    // Get position as the highest position + 1
    const existingPlaylistSongs = await db
      .select()
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId));

    const position =
      existingPlaylistSongs.length > 0
        ? Math.max(...existingPlaylistSongs.map((ps: PlaylistSong) => ps.position || 0)) + 1
        : 1;

    const [playlistSong] = await db
      .insert(playlistSongs)
      .values({
        playlistId,
        songId,
        position,
      })
      .returning();
    return playlistSong;
  }

  async removeSongFromPlaylist(
    playlistId: string,
    songId: string,
  ): Promise<void> {
    await db
      .delete(playlistSongs)
      .where(
        and(
          eq(playlistSongs.playlistId, playlistId),
          eq(playlistSongs.songId, songId),
        ),
      );
  }

  async getPlaylistSongs(
    playlistId: string,
  ): Promise<(PlaylistSong & { song: Song })[]> {
    const result = await db
      .select({
        id: playlistSongs.id,
        playlistId: playlistSongs.playlistId,
        songId: playlistSongs.songId,
        position: playlistSongs.position,
        addedAt: playlistSongs.addedAt,
        song: songs,
      })
      .from(playlistSongs)
      .innerJoin(songs, eq(playlistSongs.songId, songs.id))
      .where(eq(playlistSongs.playlistId, playlistId))
      .orderBy(playlistSongs.position);

    return result;
  }

  // Sample Packs
  async getSamplePack(id: string): Promise<SamplePack | undefined> {
    const [pack] = await db
      .select()
      .from(samplePacks)
      .where(eq(samplePacks.id, id));
    return pack || undefined;
  }

  async getSamplePacks(limit = 100, offset = 0): Promise<SamplePack[]> {
    return await db
      .select()
      .from(samplePacks)
      .orderBy(desc(samplePacks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createSamplePack(pack: InsertSamplePack): Promise<SamplePack> {
    const [newPack] = await db.insert(samplePacks).values(pack).returning();
    return newPack;
  }

  async deleteSamplePack(id: string): Promise<void> {
    // Remove all samples in this pack first
    await db.delete(samples).where(eq(samples.packId, id));
    await db.delete(samplePacks).where(eq(samplePacks.id, id));
  }

  // Samples
  async getSample(id: string): Promise<Sample | undefined> {
    const [sample] = await db.select().from(samples).where(eq(samples.id, id));
    return sample || undefined;
  }

  async getAllSamples(limit = 100, offset = 0): Promise<Sample[]> {
    return await db.select().from(samples).orderBy(desc(samples.createdAt)).limit(limit).offset(offset);
  }

  async getSamplesByPack(packId: string): Promise<Sample[]> {
    return await db
      .select()
      .from(samples)
      .where(eq(samples.packId, packId))
      .orderBy(desc(samples.createdAt));
  }

  async createSample(sample: InsertSample): Promise<Sample> {
    const [newSample] = await db.insert(samples).values(sample).returning();
    return newSample;
  }

  async deleteSample(id: string): Promise<void> {
    await db.delete(samples).where(eq(samples.id, id));
  }

  async updateUserUsage(userId: string, uploads: number, generations: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        monthlyUploads: uploads,
        monthlyGenerations: generations,
        lastUsageReset: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async incrementUserUsage(userId: string, type: 'uploads' | 'generations'): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...(type === 'uploads' && { monthlyUploads: sql`COALESCE(${users.monthlyUploads}, 0) + 1` }),
        ...(type === 'generations' && { monthlyGenerations: sql`COALESCE(${users.monthlyGenerations}, 0) + 1` }),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserCredits(userId: string, creditsDelta: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        credits: sql`GREATEST(0, COALESCE(${users.credits}, 10) + ${creditsDelta})`,
        totalCreditsSpent: sql`COALESCE(${users.totalCreditsSpent}, 0) + ${Math.abs(creditsDelta)}`,
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async atomicDeductCredits(userId: string, amount: number): Promise<User> {
    // Single UPDATE that only succeeds if credits >= amount — prevents overdraft race conditions
    const [user] = await db
      .update(users)
      .set({
        credits: sql`${users.credits} - ${amount}`,
        totalCreditsSpent: sql`COALESCE(${users.totalCreditsSpent}, 0) + ${amount}`,
      })
      .where(and(eq(users.id, userId), sql`COALESCE(${users.credits}, 0) >= ${amount}`))
      .returning();
    if (!user) throw new Error(`Insufficient credits or user not found`);
    return user;
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getUserByActivationKey(activationKey: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.activationKey, activationKey))
      .limit(1);
    return user || undefined;
  }

  async activateUserKey(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        activatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async setUserActivationKey(userId: string, activationKey: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        activationKey,
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);
    return subscription || undefined;
  }

  async upsertUserSubscription(subscription: InsertUserSubscription): Promise<UserSubscription> {
    const now = new Date();
    const updatePayload: Partial<InsertUserSubscription> & { updatedAt: Date } = {
      updatedAt: now,
    };

    if (subscription.stripeCustomerId !== undefined) {
      updatePayload.stripeCustomerId = subscription.stripeCustomerId;
    }
    if (subscription.stripeSubscriptionId !== undefined) {
      updatePayload.stripeSubscriptionId = subscription.stripeSubscriptionId;
    }
    if (subscription.status !== undefined) {
      updatePayload.status = subscription.status;
    }
    if (subscription.currentPeriodEnd !== undefined) {
      updatePayload.currentPeriodEnd = subscription.currentPeriodEnd;
    }

    const [record] = await db
      .insert(userSubscriptions)
      .values({
        userId: subscription.userId,
        stripeCustomerId: subscription.stripeCustomerId ?? null,
        stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
        status: subscription.status ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd ?? null,
        createdAt: subscription.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: updatePayload,
      })
      .returning();
    return record;
  }

  async updateSubscriptionStatusByStripeId(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodEnd?: Date | null,
  ): Promise<UserSubscription | undefined> {
    const updateData: Partial<InsertUserSubscription> & { status: string; updatedAt: Date } = {
      status,
      updatedAt: new Date(),
    };

    if (currentPeriodEnd !== undefined) {
      updateData.currentPeriodEnd = currentPeriodEnd;
    }

    const [record] = await db
      .update(userSubscriptions)
      .set(updateData)
      .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .returning();
    return record || undefined;
  }

  // Credit Transactions
  async logCreditTransaction(transaction: InsertCreditTransaction): Promise<void> {
    await db.insert(creditTransactions).values(transaction);
  }

  async getCreditTransactions(userId: string, limit: number, offset: number): Promise<CreditTransaction[]> {
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    return transactions;
  }

  async getCreditTransaction(transactionId: string): Promise<CreditTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.id, transactionId))
      .limit(1);
    return transaction || undefined;
  }

  // ============ TRACKS - Single source of truth for all audio ============
  async getTrack(id: string): Promise<Track | undefined> {
    const [track] = await db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    return track || undefined;
  }

  async getProjectTracks(projectId: string): Promise<Track[]> {
    return db.select().from(tracks).where(eq(tracks.projectId, projectId)).orderBy(tracks.position);
  }

  async getUserTracks(userId: string): Promise<Track[]> {
    return db.select().from(tracks).where(eq(tracks.userId, userId)).orderBy(desc(tracks.createdAt));
  }

  async createTrack(userId: string, projectId: string | null, track: InsertTrack): Promise<Track> {
    const [newTrack] = await db
      .insert(tracks)
      .values({
        ...track,
        userId,
        projectId,
      })
      .returning();
    return newTrack;
  }

  async updateTrack(id: string, data: Partial<Track>): Promise<Track> {
    const [updated] = await db
      .update(tracks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tracks.id, id))
      .returning();
    if (!updated) throw new Error("Track not found");
    return updated;
  }

  async deleteTrack(id: string): Promise<void> {
    await db.delete(tracks).where(eq(tracks.id, id));
  }

  async deleteProjectTracks(projectId: string): Promise<void> {
    await db.delete(tracks).where(eq(tracks.projectId, projectId));
  }

  // ============ JAM SESSIONS ============
  async getJamSession(id: string): Promise<JamSession | undefined> {
    const [session] = await db.select().from(jamSessions).where(eq(jamSessions.id, id)).limit(1);
    return session || undefined;
  }

  async getActiveJamSessions(): Promise<JamSession[]> {
    return db.select().from(jamSessions).where(eq(jamSessions.isActive, true)).orderBy(desc(jamSessions.createdAt));
  }

  async getUserJamSessions(userId: string): Promise<JamSession[]> {
    return db.select().from(jamSessions).where(eq(jamSessions.hostId, userId)).orderBy(desc(jamSessions.createdAt));
  }

  async createJamSession(hostId: string, session: InsertJamSession): Promise<JamSession> {
    const [newSession] = await db
      .insert(jamSessions)
      .values({
        ...session,
        hostId,
      })
      .returning();
    return newSession;
  }

  async updateJamSession(id: string, data: Partial<JamSession>): Promise<JamSession> {
    const [updated] = await db
      .update(jamSessions)
      .set(data)
      .where(eq(jamSessions.id, id))
      .returning();
    if (!updated) throw new Error("Jam session not found");
    return updated;
  }

  async endJamSession(id: string): Promise<JamSession> {
    const [ended] = await db
      .update(jamSessions)
      .set({ isActive: false, endedAt: new Date() })
      .where(eq(jamSessions.id, id))
      .returning();
    if (!ended) throw new Error("Jam session not found");
    return ended;
  }

  // ============ JAM CONTRIBUTIONS ============
  async getJamContributions(sessionId: string): Promise<JamContribution[]> {
    return db.select().from(jamContributions).where(eq(jamContributions.sessionId, sessionId)).orderBy(jamContributions.createdAt);
  }

  async createJamContribution(sessionId: string, userId: string, contribution: InsertJamContribution): Promise<JamContribution> {
    const [newContribution] = await db
      .insert(jamContributions)
      .values({
        ...contribution,
        sessionId,
        userId,
      })
      .returning();
    return newContribution;
  }

  // ============ JAM LIKES ============
  async addJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<JamLike> {
    const [like] = await db
      .insert(jamLikes)
      .values({
        sessionId,
        contributionId,
        userId,
      })
      .returning();
    return like;
  }

  async removeJamLike(sessionId: string, contributionId: string | null, userId: string): Promise<void> {
    if (contributionId) {
      await db.delete(jamLikes).where(
        and(
          eq(jamLikes.sessionId, sessionId),
          eq(jamLikes.contributionId, contributionId),
          eq(jamLikes.userId, userId)
        )
      );
    } else {
      await db.delete(jamLikes).where(
        and(
          eq(jamLikes.sessionId, sessionId),
          eq(jamLikes.userId, userId)
        )
      );
    }
  }

  // ============ SOCIAL FEATURES - USER PROFILES ============
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values({
        userId,
        displayName: data.displayName,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        websiteUrl: data.websiteUrl,
        socialLinks: data.socialLinks,
        location: data.location,
        favoriteGenres: data.favoriteGenres,
        instruments: data.instruments,
        skillLevel: data.skillLevel,
      })
      .returning();
    return profile;
  }

  async updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const [updated] = await db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    if (!updated) throw new Error("User profile not found");
    return updated;
  }

  // ============ SOCIAL FEATURES - FOLLOWS ============
  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const [follow] = await db
      .insert(userFollows)
      .values({
        followerId,
        followingId,
      })
      .returning();
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db.delete(userFollows).where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId)
      )
    );
  }

  async isUserFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [follow] = await db.select().from(userFollows).where(
      and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId)
      )
    );
    return !!follow;
  }

  async getUserFollowersCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followingId, userId));
    return result[0]?.count || 0;
  }

  async getUserFollowingCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(userFollows).where(eq(userFollows.followerId, userId));
    return result[0]?.count || 0;
  }

  async getUserFollowers(userId: string): Promise<any[]> {
    const follows = await db.select().from(userFollows).where(eq(userFollows.followingId, userId));
    const followerIds = follows.map((f: typeof follows[number]) => f.followerId);
    if (followerIds.length === 0) return [];
    const followers = await db.select().from(users).where(sql`${users.id} IN ${followerIds}`);
    return followers.map((u: typeof followers[number]) => ({ id: u.id, name: u.username, email: u.email }));
  }

  async getUserFollowing(userId: string): Promise<any[]> {
    const follows = await db.select().from(userFollows).where(eq(userFollows.followerId, userId));
    const followingIds = follows.map((f: typeof follows[number]) => f.followingId);
    if (followingIds.length === 0) return [];
    const following = await db.select().from(users).where(sql`${users.id} IN ${followingIds}`);
    return following.map((u: typeof following[number]) => ({ id: u.id, name: u.username, email: u.email }));
  }


  async getProjectShares(projectId: string): Promise<ProjectShare[]> {
    return db.select().from(projectShares).where(eq(projectShares.projectId, projectId));
  }

  async getUserSharedProjects(userId: string): Promise<ProjectShare[]> {
    return db.select().from(projectShares).where(eq(projectShares.sharedWithUserId, userId));
  }

  async createProjectShare(projectId: string, sharedByUserId: string, sharedWithUserId: string, permission = "view"): Promise<ProjectShare> {
    const [share] = await db
      .insert(projectShares)
      .values({
        projectId,
        sharedByUserId,
        sharedWithUserId,
        permission,
      })
      .returning();
    return share;
  }

  // ============ SOCIAL FEATURES - POSTS & FEED ============
  async getSocialFeed(userId: string): Promise<any[]> {
    const follows = await db.select().from(userFollows).where(eq(userFollows.followerId, userId));
    const followingIds = follows.map((f: typeof follows[number]) => f.followingId).filter(Boolean) as string[];

    // Get own posts + posts from people we follow
    const allPosts = await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).limit(50);
    const relevantPosts = allPosts.filter((p: any) => p.userId === userId || followingIds.includes(p.userId || ''));

    // Enrich with user info
    const enriched = [];
    for (const post of relevantPosts) {
      const user = post.userId ? await this.getUser(post.userId) : null;
      enriched.push({
        ...post,
        username: user?.username || 'Anonymous',
        displayName: user?.username || 'Anonymous',
        avatar: '',
      });
    }
    return enriched;
  }

  async getPublicOrganismFeed(limit: number): Promise<any[]> {
    const posts = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.type, 'organism-session'))
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);

    const enriched = [];
    for (const post of posts) {
      const user = post.userId ? await this.getUser(post.userId) : null;
      enriched.push({
        ...post,
        username: user?.username || 'Anonymous',
        displayName: user?.username || 'Anonymous',
        avatar: '',
      });
    }
    return enriched;
  }

  async createSocialPost(userId: string, data: any): Promise<any> {
    const [post] = await db
      .insert(socialPosts)
      .values({
        userId,
        platform: data.platform || 'codedswitch',
        content: data.content,
        type: data.type || 'share',
        title: data.title || '',
        url: data.url || '',
        mediaUrl: data.mediaUrl || null,
        projectId: data.projectId || null,
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
        views: data.views || 0,
      })
      .returning();
    return post;
  }

  async createSocialConnection(userId: string, data: any): Promise<any> {
    // Upsert: if connection for this platform exists, update it
    const existing = await db.select().from(socialConnections)
      .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, data.platform)));

    if (existing.length > 0) {
      const [updated] = await db.update(socialConnections)
        .set({ connected: true, accessToken: data.accessToken || '', refreshToken: data.refreshToken || '', updatedAt: new Date() })
        .where(eq(socialConnections.id, existing[0].id))
        .returning();
      return updated;
    }

    const [conn] = await db
      .insert(socialConnections)
      .values({
        userId,
        platform: data.platform,
        platformUserId: data.platformUserId || null,
        platformUsername: data.platformUsername || null,
        accessToken: data.accessToken || '',
        refreshToken: data.refreshToken || '',
        connected: true,
        followers: 0,
      })
      .returning();
    return conn;
  }

  async getUserSocialConnections(userId: string): Promise<any[]> {
    return db.select().from(socialConnections).where(eq(socialConnections.userId, userId));
  }

  async disconnectSocialPlatform(userId: string, platform: string): Promise<void> {
    await db.update(socialConnections)
      .set({ connected: false, updatedAt: new Date() })
      .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)));
  }

  // ============ CHAT MESSAGES ============
  async sendChatMessage(senderId: string, recipientId: string, content: string, messageType: string = 'text', attachmentUrl?: string): Promise<any> {
    const conversationId = [senderId, recipientId].sort().join(':');
    const [msg] = await db
      .insert(chatMessages)
      .values({ senderId, recipientId, conversationId, content, messageType, attachmentUrl: attachmentUrl || null })
      .returning();
    return msg;
  }

  async getChatConversation(userId1: string, userId2: string, limit: number = 50): Promise<any[]> {
    const conversationId = [userId1, userId2].sort().join(':');
    return db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async getUserConversations(userId: string): Promise<any[]> {
    // Get distinct conversation IDs for this user, with latest message
    const sent = await db.select().from(chatMessages).where(eq(chatMessages.senderId, userId));
    const received = await db.select().from(chatMessages).where(eq(chatMessages.recipientId, userId));
    const allMessages = [...sent, ...received];

    // Group by conversationId, pick latest
    const convMap = new Map<string, any>();
    for (const msg of allMessages) {
      const existing = convMap.get(msg.conversationId);
      if (!existing || new Date(msg.createdAt || 0) > new Date(existing.createdAt || 0)) {
        convMap.set(msg.conversationId, msg);
      }
    }

    const conversations = [];
    for (const [convId, lastMsg] of convMap.entries()) {
      const otherId = lastMsg.senderId === userId ? lastMsg.recipientId : lastMsg.senderId;
      const otherUser = otherId ? await this.getUser(otherId) : null;
      const unread = received.filter((m: any) => m.conversationId === convId && !m.readAt).length;
      conversations.push({
        conversationId: convId,
        otherUserId: otherId,
        otherUserName: otherUser?.username || 'Unknown',
        lastMessage: lastMsg.content,
        lastMessageAt: lastMsg.createdAt,
        unreadCount: unread,
      });
    }
    return conversations.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
  }

  async markMessagesRead(userId: string, conversationId: string): Promise<void> {
    await db.update(chatMessages)
      .set({ readAt: new Date() })
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.recipientId, userId)));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(and(eq(chatMessages.recipientId, userId), sql`${chatMessages.readAt} IS NULL`));
    return result[0]?.count || 0;
  }

  // ============ DISCOVER USERS ============
  async discoverUsers(userId: string, limit: number = 20): Promise<any[]> {
    // Get users the current user is NOT already following
    const following = await db.select().from(userFollows).where(eq(userFollows.followerId, userId));
    const followingIds = new Set(following.map((f: any) => f.followingId));
    followingIds.add(userId); // exclude self

    const allUsers = await db.select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .limit(limit + followingIds.size);

    return allUsers
      .filter((u: any) => !followingIds.has(u.id))
      .slice(0, limit)
      .map((u: any) => ({ id: u.id, name: u.username, email: u.email }));
  }

  // ============ COLLAB INVITES ============
  async createCollabInvite(data: InsertCollabInvite): Promise<CollabInvite> {
    const [invite] = await db
      .insert(collabInvites)
      .values(data)
      .returning();
    return invite;
  }

  async getCollabInvite(id: number): Promise<CollabInvite | undefined> {
    const [invite] = await db.select().from(collabInvites).where(eq(collabInvites.id, id));
    return invite || undefined;
  }

  async getUserPendingInvites(userId: string): Promise<any[]> {
    const invites = await db
      .select()
      .from(collabInvites)
      .where(and(eq(collabInvites.toUserId, userId), eq(collabInvites.status, 'pending')))
      .orderBy(desc(collabInvites.createdAt));
    const enriched = [];
    for (const inv of invites) {
      const sender = await db.select({ id: users.id, username: users.username, email: users.email }).from(users).where(eq(users.id, inv.fromUserId));
      enriched.push({
        ...inv,
        fromUser: sender[0] ? { id: sender[0].id, name: sender[0].username, email: sender[0].email } : null,
      });
    }
    return enriched;
  }

  async getUserSentInvites(userId: string): Promise<any[]> {
    const invites = await db
      .select()
      .from(collabInvites)
      .where(eq(collabInvites.fromUserId, userId))
      .orderBy(desc(collabInvites.createdAt));
    const enriched = [];
    for (const inv of invites) {
      const recipient = await db.select({ id: users.id, username: users.username, email: users.email }).from(users).where(eq(users.id, inv.toUserId));
      enriched.push({
        ...inv,
        toUser: recipient[0] ? { id: recipient[0].id, name: recipient[0].username, email: recipient[0].email } : null,
      });
    }
    return enriched;
  }

  async updateCollabInviteStatus(id: number, status: string): Promise<CollabInvite> {
    const [invite] = await db
      .update(collabInvites)
      .set({ status })
      .where(eq(collabInvites.id, id))
      .returning();
    return invite;
  }

  async getInviteCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(collabInvites)
      .where(and(eq(collabInvites.toUserId, userId), eq(collabInvites.status, 'pending')));
    return result[0]?.count || 0;
  }

  // Voice Convert Jobs
  async createVoiceConvertJob(userId: string, data: InsertVoiceConvertJob): Promise<VoiceConvertJob> {
    const [job] = await db
      .insert(voiceConvertJobs)
      .values({ ...data, userId })
      .returning();
    return job;
  }

  async getVoiceConvertJob(id: string): Promise<VoiceConvertJob | undefined> {
    const [job] = await db.select().from(voiceConvertJobs).where(eq(voiceConvertJobs.id, id));
    return job || undefined;
  }

  async getUserVoiceConvertJobs(userId: string, limit: number = 20): Promise<VoiceConvertJob[]> {
    return db
      .select()
      .from(voiceConvertJobs)
      .where(eq(voiceConvertJobs.userId, userId))
      .orderBy(desc(voiceConvertJobs.createdAt))
      .limit(limit);
  }

  async updateVoiceConvertJob(id: string, data: Partial<VoiceConvertJob>): Promise<VoiceConvertJob> {
    const [job] = await db
      .update(voiceConvertJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(voiceConvertJobs.id, id))
      .returning();
    return job;
  }

  // User API Keys
  async getUserApiKeys(userId: string): Promise<UserApiKey[]> {
    return db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId))
      .orderBy(desc(userApiKeys.createdAt));
  }

  async getUserApiKey(userId: string, service: string): Promise<UserApiKey | undefined> {
    const [key] = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.service, service)));
    return key || undefined;
  }

  async upsertUserApiKey(userId: string, data: InsertUserApiKey): Promise<UserApiKey> {
    const existing = await this.getUserApiKey(userId, data.service);
    if (existing) {
      const [updated] = await db
        .update(userApiKeys)
        .set({ encryptedKey: data.encryptedKey, keyHint: data.keyHint, isValid: true, updatedAt: new Date() })
        .where(eq(userApiKeys.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(userApiKeys)
      .values({ ...data, userId })
      .returning();
    return created;
  }

  async deleteUserApiKey(userId: string, service: string): Promise<void> {
    await db.delete(userApiKeys)
      .where(and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.service, service)
      ));
  }

  // Blog Posts
  async createBlogPost(userId: string, data: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db
      .insert(blogPosts)
      .values({ ...data, userId })
      .returning();
    return post;
  }

  async updateBlogPost(postId: string, data: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db
      .update(blogPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blogPosts.id, postId))
      .returning();
    return post;
  }

  async deleteBlogPost(postId: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, postId));
  }

  async getBlogPost(id: string): Promise<BlogPost | null> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post ?? null;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post ?? null;
  }

  async getUserBlogPosts(userId: string): Promise<BlogPost[]> {
    return db.select().from(blogPosts)
      .where(eq(blogPosts.userId, userId))
      .orderBy(desc(blogPosts.createdAt));
  }

  async getPublishedBlogPosts(limit = 50, offset = 0): Promise<BlogPost[]> {
    return db.select().from(blogPosts)
      .where(eq(blogPosts.isPublished, true))
      .orderBy(desc(blogPosts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRelatedBlogPosts(category: string, excludeSlug: string): Promise<BlogPost[]> {
    return db.select().from(blogPosts)
      .where(and(
        eq(blogPosts.category, category),
        eq(blogPosts.isPublished, true),
        sql`${blogPosts.slug} != ${excludeSlug}`
      ))
      .limit(3);
  }

  async incrementBlogPostViews(id: string): Promise<void> {
    await db.update(blogPosts)
      .set({ views: sql`COALESCE(views, 0) + 1` })
      .where(eq(blogPosts.id, id));
  }

  // WebEar API Keys
  async getWebearKeyByValue(key: string): Promise<WebearApiKey | undefined> {
    const [row] = await db
      .select()
      .from(webearApiKeys)
      .where(and(eq(webearApiKeys.key, key), eq(webearApiKeys.isActive, true)));
    return row || undefined;
  }

  async getWebearKeyByUserId(userId: string): Promise<WebearApiKey | undefined> {
    const [row] = await db
      .select()
      .from(webearApiKeys)
      .where(and(eq(webearApiKeys.userId, userId), eq(webearApiKeys.isActive, true)))
      .orderBy(desc(webearApiKeys.createdAt));
    return row || undefined;
  }

  async createWebearKey(userId: string): Promise<WebearApiKey> {
    // Revoke any existing active key first
    await db
      .update(webearApiKeys)
      .set({ isActive: false })
      .where(eq(webearApiKeys.userId, userId));

    const key = 'wbr_' + randomBytes(32).toString('hex');
    const [row] = await db
      .insert(webearApiKeys)
      .values({ userId, key, name: 'Default' })
      .returning();
    return row;
  }

  async revokeWebearKey(userId: string): Promise<void> {
    await db
      .update(webearApiKeys)
      .set({ isActive: false })
      .where(eq(webearApiKeys.userId, userId));
  }

  async incrementWebearKeyUsage(keyId: string): Promise<void> {
    await db
      .update(webearApiKeys)
      .set({ usageCount: sql`usage_count + 1`, lastUsedAt: new Date() })
      .where(eq(webearApiKeys.id, keyId));
  }
}

// Switch to DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
