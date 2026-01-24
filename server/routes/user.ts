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

      // Calculate user stats
      const userStats = await calculateUserStats(req.userId, storage);

      // Build profile response
      const profile = {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        bio: user.bio || 'Music creator using CodedSwitch AI tools',
        avatar: user.avatar || '',
        followers: userStats.followers,
        following: userStats.following,
        totalShares: userStats.totalShares,
        totalViews: userStats.totalViews,
        rating: userStats.rating,
        level: calculateUserLevel(userStats.totalShares, userStats.totalViews),
        achievements: getUserAchievements(userStats),
        socialLinks: user.socialLinks || {},
        subscription: subscription ? {
          tier: subscription.tier || 'free',
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

      // Update user profile
      const updatedUser = await storage.updateUser(req.userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          displayName: updatedUser.displayName,
          bio: updatedUser.bio,
          socialLinks: updatedUser.socialLinks,
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

      const stats = await calculateUserStats(req.userId, storage);
      const creditBalance = await creditService.getBalance(req.userId);

      res.json({
        ...stats,
        credits: creditBalance,
        level: calculateUserLevel(stats.totalShares, stats.totalViews),
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

async function calculateUserStats(userId: string, storage: IStorage) {
  try {
    // Get user's songs/projects
    const songs = await storage.getUserSongs(userId, 1000, 0);
    
    // Calculate stats
    const totalShares = songs.reduce((sum, song) => sum + (song.shares || 0), 0);
    const totalViews = songs.reduce((sum, song) => sum + (song.views || 0), 0);
    
    // Get followers/following counts
    const followers = await storage.getUserFollowersCount(userId);
    const following = await storage.getUserFollowingCount(userId);
    
    // Calculate average rating
    const ratedSongs = songs.filter(song => song.rating && song.rating > 0);
    const rating = ratedSongs.length > 0 
      ? ratedSongs.reduce((sum, song) => sum + song.rating, 0) / ratedSongs.length 
      : 0;

    return {
      totalShares,
      totalViews,
      followers,
      following,
      rating: Math.round(rating * 10) / 10, // Round to 1 decimal
      totalSongs: songs.length,
    };
  } catch (error) {
    console.error('Calculate user stats error:', error);
    return {
      totalShares: 0,
      totalViews: 0,
      followers: 0,
      following: 0,
      rating: 0,
      totalSongs: 0,
    };
  }
}

function calculateUserLevel(totalShares: number, totalViews: number): number {
  // Level calculation based on engagement
  const engagementScore = totalShares * 10 + totalViews;
  
  if (engagementScore >= 100000) return 20;
  if (engagementScore >= 50000) return 15;
  if (engagementScore >= 20000) return 12;
  if (engagementScore >= 10000) return 10;
  if (engagementScore >= 5000) return 8;
  if (engagementScore >= 2000) return 6;
  if (engagementScore >= 1000) return 5;
  if (engagementScore >= 500) return 4;
  if (engagementScore >= 100) return 3;
  if (engagementScore >= 50) return 2;
  return 1;
}

function getUserAchievements(stats: any): string[] {
  const achievements = [];
  
  if (stats.totalShares >= 1000) achievements.push('Social Star');
  if (stats.totalShares >= 500) achievements.push('Sharing Master');
  if (stats.totalViews >= 10000) achievements.push('Viral Creator');
  if (stats.totalViews >= 5000) achievements.push('Rising Star');
  if (stats.totalSongs >= 50) achievements.push('Prolific Creator');
  if (stats.totalSongs >= 25) achievements.push('Beat Master');
  if (stats.totalSongs >= 10) achievements.push('Code Composer');
  if (stats.rating >= 4.5) achievements.push('Top Rated');
  if (stats.followers >= 1000) achievements.push('Influencer');
  if (stats.followers >= 500) achievements.push('Community Leader');
  if (stats.followers >= 100) achievements.push('People\'s Choice');
  
  return achievements;
}

async function getUserActivity(userId: string, storage: IStorage, limit: number, offset: number) {
  try {
    // Get user's recent songs
    const songs = await storage.getUserSongs(userId, limit, offset);
    
    // Format activity items
    const activity = songs.map(song => ({
      id: song.id,
      type: getContentType(song.type),
      title: song.title || 'Untitled',
      time: formatTimeAgo(song.createdAt),
      plays: song.views || 0,
      shares: song.shares || 0,
      rating: song.rating || 0,
      url: `/studio/${song.id}`,
    }));

    return {
      activity,
      hasMore: songs.length === limit,
    };
  } catch (error) {
    console.error('Get user activity error:', error);
    return {
      activity: [],
      hasMore: false,
    };
  }
}

function getContentType(type: string): string {
  switch (type) {
    case 'beat': return 'Beat';
    case 'melody': return 'Melody';
    case 'full-song': return 'Full Song';
    case 'code-music': return 'Code→Music';
    case 'instrumental': return 'Instrumental';
    default: return 'Creation';
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
