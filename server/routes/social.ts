/**
 * Social Hub API Routes
 * Handles social media integration, sharing, and analytics
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';

export function createSocialRoutes(storage: IStorage) {
  const router = Router();

  /**
   * GET /api/social/stats
   * Get user's social media statistics
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

      // Get user's social media stats
      const stats = await calculateSocialStats(req.userId, storage);

      res.json(stats);
    } catch (error) {
      console.error('Get social stats error:', error);
      res.status(500).json({ error: 'Failed to fetch social stats' });
    }
  });

  /**
   * GET /api/social/posts
   * Get recent social media posts
   */
  router.get('/posts', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      // Get recent posts
      const posts = await getRecentPosts(req.userId, storage, limit, offset);

      res.json({ posts });
    } catch (error) {
      console.error('Get social posts error:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  /**
   * POST /api/social/share
   * Share content to social media platforms
   */
  router.post('/share', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        platform: z.enum(['twitter', 'facebook', 'instagram', 'youtube']),
        content: z.string().min(1).max(280),
        type: z.enum(['beat', 'melody', 'project', 'share']),
        title: z.string().min(1).max(100),
        url: z.string().url(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: parsed.error.errors 
        });
      }

      const { platform, content, type, title, url } = parsed.data;

      // Create social share record
      const share = await storage.createSocialShare({
        userId: req.userId,
        platform,
        content,
        type,
        title,
        url,
        createdAt: new Date(),
      });

      // Update user stats
      await updateUserSocialStats(req.userId, storage, platform);

      res.json({
        message: 'Content shared successfully',
        share: {
          id: share.id,
          platform,
          content,
          createdAt: share.createdAt,
        }
      });
    } catch (error) {
      console.error('Social share error:', error);
      res.status(500).json({ error: 'Failed to share content' });
    }
  });

  /**
   * POST /api/social/connect
   * Connect social media platform
   */
  router.post('/connect', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        platform: z.enum(['twitter', 'facebook', 'instagram', 'youtube']),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: parsed.error.errors 
        });
      }

      const { platform } = parsed.data;

      // In a real implementation, this would handle OAuth flow
      // For now, we'll simulate a successful connection
      const connection = await storage.createSocialConnection({
        userId: req.userId,
        platform,
        connected: true,
        connectedAt: new Date(),
        profileUrl: `https://${platform}.com/user/${req.userId}`,
      });

      res.json({
        message: `${platform} connected successfully`,
        connection: {
          id: connection.id,
          platform,
          connected: true,
          profileUrl: connection.profileUrl,
        }
      });
    } catch (error) {
      console.error('Social connect error:', error);
      res.status(500).json({ error: 'Failed to connect platform' });
    }
  });

  /**
   * POST /api/social/like/:postId
   * Like/unlike a social post
   */
  router.post('/like/:postId', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const postId = req.params.postId;
      const { liked } = req.body;

      // Update post likes
      const post = await storage.updateSocialPostLikes(postId, req.userId, liked);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({
        message: liked ? 'Post liked' : 'Post unliked',
        likes: post.likes,
        isLiked: liked,
      });
    } catch (error) {
      console.error('Social like error:', error);
      res.status(500).json({ error: 'Failed to update like status' });
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

      // Follow user
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

      // Unfollow user
      await storage.unfollowUser(req.userId, targetUserId);

      res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
      console.error('Social unfollow error:', error);
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  });

  return router;
}

// Helper functions

async function calculateSocialStats(userId: string, storage: IStorage) {
  try {
    // Get user's social shares
    const shares = await storage.getUserSocialShares(userId, 1000, 0);
    
    // Calculate stats
    const totalShares = shares.length;
    const totalViews = shares.reduce((sum, share) => sum + (share.views || 0), 0);
    const totalLikes = shares.reduce((sum, share) => sum + (share.likes || 0), 0);
    const totalComments = shares.reduce((sum, share) => sum + (share.comments || 0), 0);
    
    // Calculate weekly growth (simplified)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyShares = shares.filter(share => new Date(share.createdAt) > oneWeekAgo);
    const weeklyGrowth = totalShares > 0 ? Math.round((weeklyShares.length / totalShares) * 100) : 0;
    
    // Find top platform
    const platformCounts = shares.reduce((acc, share) => {
      acc[share.platform] = (acc[share.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topPlatform = Object.entries(platformCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

    return {
      totalShares,
      totalViews,
      totalLikes,
      totalComments,
      weeklyGrowth,
      topPlatform,
    };
  } catch (error) {
    console.error('Calculate social stats error:', error);
    return {
      totalShares: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      weeklyGrowth: 0,
      topPlatform: 'None',
    };
  }
}

async function getRecentPosts(userId: string, storage: IStorage, limit: number, offset: number) {
  try {
    // Get user's recent social shares
    const shares = await storage.getUserSocialShares(userId, limit, offset);
    
    // Format as posts
    const posts = shares.map(share => ({
      id: share.id,
      userId: share.userId,
      username: share.username || 'user',
      displayName: share.displayName || 'User',
      avatar: share.avatar || '',
      content: share.content,
      type: share.type,
      title: share.title,
      url: share.url,
      platform: share.platform,
      likes: share.likes || 0,
      comments: share.comments || 0,
      shares: 0, // Not tracked in this simple implementation
      createdAt: formatTimeAgo(share.createdAt),
      isLiked: false, // Would be determined by checking user's likes
    }));

    return posts;
  } catch (error) {
    console.error('Get recent posts error:', error);
    return [];
  }
}

async function updateUserSocialStats(userId: string, storage: IStorage, platform: string) {
  try {
    // Update user's social stats for the platform
    // This would typically involve API calls to the social media platform
    // For now, we'll just increment a counter
    const user = await storage.getUser(userId);
    if (user) {
      const socialStats = user.socialStats || {};
      socialStats[platform] = (socialStats[platform] || 0) + 1;
      await storage.updateUser(userId, { socialStats });
    }
  } catch (error) {
    console.error('Update user social stats error:', error);
  }
}

function formatTimeAgo(date: Date | string | undefined): string {
  if (!date) return 'Unknown';
  
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return past.toLocaleDateString();
}
