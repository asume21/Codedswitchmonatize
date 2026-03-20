/**
 * Social Hub API Routes
 * Handles user follows and project sharing
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
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
   * Get social feed of posts from followed users
   */
  router.get('/posts', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get posts from followed users and own posts
      const posts = await storage.getSocialFeed(req.userId);
      
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

  return router;
}
