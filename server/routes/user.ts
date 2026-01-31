/**
 * User Profile API Routes
 * Handles user profile management, stats, and social features
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';
import { getCreditService } from '../services/credits';

export function createUserRoutes(storage: IStorage) {
  const router = Router();
  const creditService = getCreditService(storage);

  /**
   * GET /api/user/profile
   * Get user profile information
   */
  router.get('/profile', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's credit balance
      const creditBalance = await creditService.getBalance(req.userId);

      // Get user's subscription info
      const subscription = await storage.getUserSubscription(req.userId);

      // Get user profile from userProfiles table
      const userProfile = await storage.getUserProfile(req.userId);

      // Get follower/following counts
      const followers = await storage.getUserFollowersCount(req.userId);
      const following = await storage.getUserFollowingCount(req.userId);

      // Build profile response
      const profile = {
        id: user.id,
        username: user.username,
        displayName: userProfile?.displayName || user.username,
        email: user.email,
        bio: userProfile?.bio || 'Music creator using CodedSwitch AI tools',
        avatar: userProfile?.avatarUrl || '',
        followers,
        following,
        level: calculateUserLevel(followers),
        achievements: getUserAchievements({ followers, following }),
        socialLinks: (userProfile?.socialLinks as Record<string, string>) || {},
        subscription: subscription ? {
          tier: user.subscriptionTier || 'free',
          hasActiveSubscription: subscription.status === 'active' || subscription.status === 'trialing',
          lastUsageReset: subscription.currentPeriodEnd?.toISOString(),
        } : undefined,
        credits: creditBalance,
        joinDate: user.createdAt?.toISOString() || new Date().toISOString(),
        isActive: true,
      };

      res.json(profile);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * PUT /api/user/profile
   * Update user profile information
   */
  router.put('/profile', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const schema = z.object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(500).optional(),
        socialLinks: z.object({
          twitter: z.string().optional(),
          instagram: z.string().optional(),
          youtube: z.string().optional(),
        }).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: parsed.error.errors 
        });
      }

      const updates = parsed.data;

      // Update user profile in userProfiles table
      let userProfile = await storage.getUserProfile(req.userId);
      if (!userProfile) {
        userProfile = await storage.createUserProfile(req.userId, {
          displayName: updates.displayName,
          bio: updates.bio,
          socialLinks: updates.socialLinks,
        });
      } else {
        userProfile = await storage.updateUserProfile(req.userId, {
          displayName: updates.displayName,
          bio: updates.bio,
          socialLinks: updates.socialLinks,
        });
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: req.userId,
          displayName: userProfile.displayName,
          bio: userProfile.bio,
          socialLinks: userProfile.socialLinks,
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  /**
   * GET /api/user/stats
   * Get detailed user statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const followers = await storage.getUserFollowersCount(req.userId);
      const following = await storage.getUserFollowingCount(req.userId);
      const creditBalance = await creditService.getBalance(req.userId);
      const songs = await storage.getUserSongs(req.userId);

      res.json({
        followers,
        following,
        totalSongs: songs.length,
        credits: creditBalance,
        level: calculateUserLevel(followers),
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /api/user/activity
   * Get user's recent activity
   */
  router.get('/activity', async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      // Get user's recent creations and shares
      const activity = await getUserActivity(req.userId, storage, limit, offset);

      res.json(activity);
    } catch (error) {
      console.error('Get activity error:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  });

  /**
   * POST /api/user/follow/:userId
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

      // Check if already following
      const isFollowing = await storage.isUserFollowing(req.userId, targetUserId);
      if (isFollowing) {
        return res.status(400).json({ error: 'Already following this user' });
      }

      // Follow user
      await storage.followUser(req.userId, targetUserId);

      res.json({ message: 'User followed successfully' });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({ error: 'Failed to follow user' });
    }
  });

  /**
   * DELETE /api/user/follow/:userId
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
      console.error('Unfollow user error:', error);
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  });

  return router;
}

// Helper functions

function calculateUserLevel(followers: number): number {
  if (followers >= 10000) return 20;
  if (followers >= 5000) return 15;
  if (followers >= 2000) return 12;
  if (followers >= 1000) return 10;
  if (followers >= 500) return 8;
  if (followers >= 200) return 6;
  if (followers >= 100) return 5;
  if (followers >= 50) return 4;
  if (followers >= 20) return 3;
  if (followers >= 10) return 2;
  return 1;
}

function getUserAchievements(stats: { followers: number; following: number }): string[] {
  const achievements: string[] = [];
  
  if (stats.followers >= 1000) achievements.push('Influencer');
  if (stats.followers >= 500) achievements.push('Community Leader');
  if (stats.followers >= 100) achievements.push('People\'s Choice');
  if (stats.followers >= 50) achievements.push('Rising Star');
  if (stats.following >= 100) achievements.push('Social Butterfly');
  
  return achievements;
}

async function getUserActivity(userId: string, storage: IStorage, limit: number, offset: number) {
  try {
    const songs = await storage.getUserSongs(userId);
    const paginatedSongs = songs.slice(offset, offset + limit);
    
    const activity = paginatedSongs.map(song => ({
      id: song.id,
      type: 'Creation',
      title: song.name || 'Untitled',
      time: formatTimeAgo(song.uploadDate ?? undefined),
      url: `/studio/${song.id}`,
    }));

    return {
      activity,
      hasMore: paginatedSongs.length === limit,
    };
  } catch (error) {
    console.error('Get user activity error:', error);
    return {
      activity: [],
      hasMore: false,
    };
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
