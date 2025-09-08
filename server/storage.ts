import {
  // Type exports
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
  // Social types
  type UserProfile,
  type InsertUserProfile,
  type UserFollow,
  type ProjectShare,
  type ProjectCollaboration,
  type ProjectComment,
  type ProjectLike,
  type ProjectVersion,
  // Table exports
  users,
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
  // Social tables
  userProfiles,
  projectShares,
  projectCollaborations,
  projectComments,
  projectLikes,
  userFollows,
  projectVersions,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(
    customerId: string,
  ): Promise<User | undefined>;
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
  getSamplePacks(): Promise<SamplePack[]>;
  createSamplePack(pack: InsertSamplePack): Promise<SamplePack>;
  deleteSamplePack(id: string): Promise<void>;

  // Samples
  getSample(id: string): Promise<Sample | undefined>;
  getAllSamples(): Promise<Sample[]>;
  getSamplesByPack(packId: string): Promise<Sample[]>;
  createSample(sample: InsertSample): Promise<Sample>;

  // Social Features
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  createUserProfile(userId: string, profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile>;
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getUserFollowers(userId: string): Promise<User[]>;
  getUserFollowing(userId: string): Promise<User[]>;
  shareProject(projectId: string, sharedById: string, sharedWithId: string, permission: string): Promise<ProjectShare>;
  getProjectShares(projectId: string): Promise<ProjectShare[]>;
  addProjectCollaborator(projectId: string, userId: string, role: string): Promise<ProjectCollaboration>;
  removeProjectCollaborator(projectId: string, userId: string): Promise<void>;
  addProjectComment(projectId: string, userId: string, content: string, parentCommentId?: string): Promise<ProjectComment>;
  getProjectComments(projectId: string): Promise<ProjectComment[]>;
  likeProject(projectId: string, userId: string): Promise<ProjectLike>;
  unlikeProject(projectId: string, userId: string): Promise<void>;
  getProjectLikes(projectId: string): Promise<ProjectLike[]>;
  createProjectVersion(projectId: string, version: number, data: any, createdBy: string, description?: string): Promise<ProjectVersion>;
  getProjectVersions(projectId: string): Promise<ProjectVersion[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projects: Map<string, Project>;
  private codeTranslations: Map<string, CodeTranslation>;
  private beatPatterns: Map<string, BeatPattern>;
  private melodies: Map<string, Melody>;
  private vulnerabilityScans: Map<string, VulnerabilityScan>;
  private lyrics: Map<string, Lyrics>;
  private songs: Map<string, Song>;
  private playlists: Map<string, Playlist>;
  private playlistSongs: Map<string, PlaylistSong>;
  private userProfiles: Map<string, UserProfile>;
  private projectShares: Map<string, ProjectShare>;
  private projectCollaborations: Map<string, ProjectCollaboration>;
  private projectComments: Map<string, ProjectComment>;
  private projectLikes: Map<string, ProjectLike>;
  private userFollows: Map<string, UserFollow>;
  private projectVersions: Map<string, ProjectVersion>;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.codeTranslations = new Map();
    this.beatPatterns = new Map();
    this.melodies = new Map();
    this.vulnerabilityScans = new Map();
    this.lyrics = new Map();
    this.songs = new Map();
    this.playlists = new Map();
    this.playlistSongs = new Map();
    this.samplePacks = new Map();
    this.samples = new Map();

    // Create default user
    const defaultUser: User = {
      id: "default-user",
      username: "CodeTuneUser",
      email: "user@codetune.studio",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionTier: "free",
      monthlyUploads: 0,
      monthlyGenerations: 0,
      lastUsageReset: new Date(),
      createdAt: new Date(),
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  async getUserByStripeCustomerId(
    customerId: string,
  ): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.stripeCustomerId === customerId,
    );
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
      monthlyUploads: 0,
      monthlyGenerations: 0,
      lastUsageReset: new Date(),
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

  async getSamplePacks(): Promise<SamplePack[]> {
    return Array.from(this.samplePacks.values()).sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime(),
    );
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

  async getAllSamples(): Promise<Sample[]> {
    return Array.from(this.samples.values()).sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime(),
    );
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

  async getUserByStripeCustomerId(
    customerId: string,
  ): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));
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
    // Get existing playlist songs to determine position
    const existingPlaylistSongs = await db
      .select()
      .from(playlistSongs)
      .where(eq(playlistSongs.playlistId, playlistId));

    const position =
      existingPlaylistSongs.length > 0
        ? Math.max(...existingPlaylistSongs.map((ps: PlaylistSong) => ps.position)) + 1
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

  async getSamplePacks(): Promise<SamplePack[]> {
    return await db
      .select()
      .from(samplePacks)
      .orderBy(desc(samplePacks.createdAt));
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

  async getAllSamples(): Promise<Sample[]> {
    return await db.select().from(samples).orderBy(desc(samples.createdAt));
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
}

// Switch to DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
