/**
 * Social Hub API Routes
 * Handles user follows and project sharing
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { IStorage } from '../storage';

export function createSocialRoutes(storage: IStorage) {
  const router = Router();

  /**
   * GET /api/social/stats
   * Get user's social statistics (followers, following, shared projects)
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const followers = await storage.getUserFollowersCount(req.userId);
      const following = await storage.getUserFollowingCount(req.userId);
      const sharedProjects = await storage.getUserSharedProjects(req.userId);

      res.json({
        followers,
        following,
        sharedProjectsCount: sharedProjects.length,
      });
    } catch (error) {
      console.error('Get social stats error:', error);
      res.status(500).json({ error: 'Failed to fetch social stats' });
    }
  });

  /**
   * GET /api/social/profile
   * Get user's social profile
   */
  router.get('/profile', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const profile = await storage.getUserProfile(req.userId);
      if (!profile) {
        return res.json({ profile: null });
      }

      res.json({ profile });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * PUT /api/social/profile
   * Update user's social profile
   */
  router.put('/profile', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        displayName: z.string().max(100).optional(),
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional(),
        websiteUrl: z.string().url().optional(),
        location: z.string().max(100).optional(),
        socialLinks: z.record(z.string()).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      let profile = await storage.getUserProfile(req.userId);
      if (!profile) {
        profile = await storage.createUserProfile(req.userId, parsed.data);
      } else {
        profile = await storage.updateUserProfile(req.userId, parsed.data);
      }

      res.json({ profile });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * POST /api/social/share-project
   * Share a project with another user
   */
  router.post('/share-project', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        projectId: z.string(),
        sharedWithUserId: z.string(),
        permission: z.enum(['view', 'edit', 'admin']).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      const { projectId, sharedWithUserId, permission } = parsed.data;

      const share = await storage.createProjectShare(
        projectId,
        req.userId,
        sharedWithUserId,
        permission || 'view'
      );

      res.json({ message: 'Project shared successfully', share });
    } catch (error) {
      console.error('Share project error:', error);
      res.status(500).json({ error: 'Failed to share project' });
    }
  });

  /**
   * GET /api/social/shared-with-me
   * Get projects shared with the current user
   */
  router.get('/shared-with-me', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const shares = await storage.getUserSharedProjects(req.userId);
      res.json({ shares });
    } catch (error) {
      console.error('Get shared projects error:', error);
      res.status(500).json({ error: 'Failed to fetch shared projects' });
    }
  });

  /**
   * POST /api/social/follow/:userId
   * Follow another user
   */
  router.post('/follow/:userId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const targetUserId = req.params.userId;
      if (req.userId === targetUserId) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
      }

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const alreadyFollowing = await storage.isUserFollowing(req.userId, targetUserId);
      if (alreadyFollowing) {
        return res.status(400).json({ error: 'Already following this user' });
      }

      await storage.followUser(req.userId, targetUserId);
      res.json({ message: 'User followed successfully' });
    } catch (error) {
      console.error('Social follow error:', error);
      res.status(500).json({ error: 'Failed to follow user' });
    }
  });

  /**
   * DELETE /api/social/follow/:userId
   * Unfollow another user
   */
  router.delete('/follow/:userId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const targetUserId = req.params.userId;
      await storage.unfollowUser(req.userId, targetUserId);
      res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
      console.error('Social unfollow error:', error);
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  });

  /**
   * GET /api/social/is-following/:userId
   * Check if current user is following another user
   */
  router.get('/is-following/:userId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const targetUserId = req.params.userId;
      const isFollowing = await storage.isUserFollowing(req.userId, targetUserId);
      res.json({ isFollowing });
    } catch (error) {
      console.error('Check following error:', error);
      res.status(500).json({ error: 'Failed to check following status' });
    }
  });

  /**
   * GET /api/social/posts
   * Get social feed of posts. Public for guests (returns organism sessions);
   * authenticated users also see posts from people they follow.
   */
  router.get('/posts', async (req: Request, res: Response) => {
    try {
      let posts: any[];
      if (req.userId) {
        posts = await storage.getSocialFeed(req.userId);
      } else {
        // Guests see only public organism-session posts
        posts = await storage.getPublicOrganismFeed(50);
      }

      res.json({
        posts,
        stats: {
          totalShares: posts.length,
          totalViews: posts.reduce((sum: number, p: any) => sum + (p.views || 0), 0),
          totalLikes: posts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0),
          totalComments: posts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0),
          weeklyGrowth: 0,
          topPlatform: 'Twitter'
        }
      });
    } catch (error) {
      console.error('Get posts error:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  /**
   * GET /api/social/feed/public
   * Public organism-session feed (no auth required).
   */
  router.get('/feed/public', async (_req: Request, res: Response) => {
    try {
      const posts = await storage.getPublicOrganismFeed(30);
      res.json({ posts });
    } catch (error) {
      console.error('Public feed error:', error);
      res.status(500).json({ error: 'Failed to fetch feed' });
    }
  });

  /**
   * POST /api/social/share-organism-session
   * Upload a beat audio blob and create an organism-session social post.
   * Auth is optional — guests can share anonymously.
   */
  const sessionUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });

  router.post('/share-organism-session', sessionUpload.single('audio'), async (req: Request, res: Response) => {
    try {
      const caption = (req.body.caption as string | undefined) || '';
      const bpm     = parseFloat(req.body.bpm as string) || 0;
      const key     = (req.body.key as string | undefined) || '';
      const dnaRaw  = (req.body.dna as string | undefined) || null;

      // Write audio file to local objects dir if provided
      let mediaUrl: string | null = null;
      if (req.file) {
        const objDir = process.env.LOCAL_OBJECTS_DIR || path.join(process.cwd(), 'objects');
        const sessDir = path.join(objDir, 'organism-sessions');
        if (!fs.existsSync(sessDir)) fs.mkdirSync(sessDir, { recursive: true });

        const filename = `${randomUUID()}.webm`;
        fs.writeFileSync(path.join(sessDir, filename), req.file.buffer);
        mediaUrl = `/objects/organism-sessions/${filename}`;
      }

      const titleParts: string[] = [];
      if (bpm)  titleParts.push(`${Math.round(bpm)} BPM`);
      if (key)  titleParts.push(key);
      const title = titleParts.length ? `Organism Session — ${titleParts.join(', ')}` : 'Organism Session';

      // Store DNA metadata in content as JSON if present, otherwise just the caption
      const content = dnaRaw
        ? JSON.stringify({ caption, bpm, key, dna: JSON.parse(dnaRaw) })
        : JSON.stringify({ caption, bpm, key });

      const post = await storage.createSocialPost(req.userId || null as unknown as string, {
        platform: 'organism',
        type:     'organism-session',
        title,
        content,
        url:      `${process.env.PUBLIC_URL || ''}/social-hub`,
        mediaUrl,
        likes: 0, comments: 0, shares: 0, views: 0,
      });

      res.json({ post, postUrl: `/social-hub` });
    } catch (error) {
      console.error('Share organism session error:', error);
      res.status(500).json({ error: 'Failed to share session' });
    }
  });

  /**
   * POST /api/social/share
   * Share content to social platform
   */
  router.post('/share', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        platform: z.string(),
        content: z.string(),
        type: z.string(),
        title: z.string(),
        url: z.string().url(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      const { platform, content, type, title, url } = parsed.data;

      // Create social post record
      const post = await storage.createSocialPost(req.userId, {
        platform,
        content,
        type,
        title,
        url,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      });

      res.json({ message: 'Shared successfully', post });
    } catch (error) {
      console.error('Share error:', error);
      res.status(500).json({ error: 'Failed to share content' });
    }
  });

  /**
   * POST /api/social/connect
   * Connect a social platform
   */
  router.post('/connect', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        platform: z.string(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      const { platform, accessToken, refreshToken } = parsed.data;

      // Store platform connection
      const connection = await storage.createSocialConnection(req.userId, {
        platform,
        accessToken: accessToken || '',
        refreshToken: refreshToken || '',
        connected: true,
      });

      res.json({ message: 'Platform connected', connection });
    } catch (error) {
      console.error('Connect platform error:', error);
      res.status(500).json({ error: 'Failed to connect platform' });
    }
  });

  /**
   * GET /api/social/followers
   * Get user's followers list
   */
  router.get('/followers', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const followers = await storage.getUserFollowers(req.userId);
      res.json({ followers });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({ error: 'Failed to fetch followers' });
    }
  });

  /**
   * GET /api/social/following
   * Get list of users the current user is following
   */
  router.get('/following', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const following = await storage.getUserFollowing(req.userId);
      res.json({ following });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({ error: 'Failed to fetch following' });
    }
  });

  /**
   * GET /api/social/connections
   * Get user's connected social platforms
   */
  router.get('/connections', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const connections = await storage.getUserSocialConnections(req.userId);
      res.json({ connections });
    } catch (error) {
      console.error('Get connections error:', error);
      res.status(500).json({ error: 'Failed to fetch connections' });
    }
  });

  /**
   * DELETE /api/social/connect/:platform
   * Disconnect a social platform
   */
  router.delete('/connect/:platform', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      await storage.disconnectSocialPlatform(req.userId, req.params.platform);
      res.json({ message: 'Platform disconnected' });
    } catch (error) {
      console.error('Disconnect platform error:', error);
      res.status(500).json({ error: 'Failed to disconnect platform' });
    }
  });

  /**
   * POST /api/social/chat/send
   * Send a chat message to another user
   */
  router.post('/chat/send', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const schema = z.object({
        recipientId: z.string(),
        content: z.string().min(1).max(5000),
        messageType: z.string().optional(),
        attachmentUrl: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }
      const { recipientId, content, messageType, attachmentUrl } = parsed.data;
      const message = await storage.sendChatMessage(req.userId, recipientId, content, messageType, attachmentUrl);
      res.json({ message });
    } catch (error) {
      console.error('Send chat message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * GET /api/social/chat/conversation/:userId
   * Get chat conversation with a specific user
   */
  router.get('/chat/conversation/:userId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const messages = await storage.getChatConversation(req.userId, req.params.userId);
      res.json({ messages });
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  /**
   * GET /api/social/chat/conversations
   * Get all conversations for the current user
   */
  router.get('/chat/conversations', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const conversations = await storage.getUserConversations(req.userId);
      res.json({ conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  /**
   * POST /api/social/chat/read/:conversationId
   * Mark messages in a conversation as read
   */
  router.post('/chat/read/:conversationId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      await storage.markMessagesRead(req.userId, req.params.conversationId);
      res.json({ message: 'Messages marked as read' });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  });

  /**
   * GET /api/social/chat/unread
   * Get unread message count
   */
  router.get('/chat/unread', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const count = await storage.getUnreadMessageCount(req.userId);
      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  /**
   * GET /api/social/discover
   * Discover other CodedSwitch users to follow
   */
  router.get('/discover', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const users = await storage.discoverUsers(req.userId, limit);
      res.json({ users });
    } catch (error) {
      console.error('Discover users error:', error);
      res.status(500).json({ error: 'Failed to discover users' });
    }
  });

  // ============ COLLAB INVITES ============

  router.post('/collab-invite', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        toUserId: z.string(),
        type: z.enum(['jam', 'project', 'feedback']),
        message: z.string().max(500).optional(),
        projectId: z.number().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      const { toUserId, type, message, projectId } = parsed.data;

      if (req.userId === toUserId) {
        return res.status(400).json({ error: 'Cannot invite yourself' });
      }

      const targetUser = await storage.getUser(toUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const invite = await storage.createCollabInvite({
        fromUserId: req.userId,
        toUserId,
        type,
        message: message || null,
        projectId: projectId || null,
        expiresAt: null,
      });

      res.json({ message: 'Invite sent', invite });
    } catch (error) {
      console.error('Send collab invite error:', error);
      res.status(500).json({ error: 'Failed to send invite' });
    }
  });

  router.get('/collab-invites/received', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const invites = await storage.getUserPendingInvites(req.userId);
      res.json({ invites });
    } catch (error) {
      console.error('Get received invites error:', error);
      res.status(500).json({ error: 'Failed to fetch invites' });
    }
  });

  router.get('/collab-invites/sent', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const invites = await storage.getUserSentInvites(req.userId);
      res.json({ invites });
    } catch (error) {
      console.error('Get sent invites error:', error);
      res.status(500).json({ error: 'Failed to fetch sent invites' });
    }
  });

  router.put('/collab-invite/:id/respond', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid invite ID' });
      }

      const schema = z.object({
        status: z.enum(['accepted', 'declined']),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      }

      const invite = await storage.getCollabInvite(id);
      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      if (invite.toUserId !== req.userId) {
        return res.status(403).json({ error: 'Not authorized to respond to this invite' });
      }

      if (invite.status !== 'pending') {
        return res.status(400).json({ error: 'Invite has already been responded to' });
      }

      const updated = await storage.updateCollabInviteStatus(id, parsed.data.status);
      res.json({ message: `Invite ${parsed.data.status}`, invite: updated });
    } catch (error) {
      console.error('Respond to invite error:', error);
      res.status(500).json({ error: 'Failed to respond to invite' });
    }
  });

  router.get('/collab-invites/count', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const count = await storage.getInviteCount(req.userId);
      res.json({ count });
    } catch (error) {
      console.error('Get invite count error:', error);
      res.status(500).json({ error: 'Failed to fetch invite count' });
    }
  });

  return router;
}
