import { Router } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';
import { requireAuth } from '../middleware/auth';

export function createBlogRouter(storage: IStorage) {
  const router = Router();

  // Get all published blog posts
  router.get('/posts', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const posts = await storage.getPublishedBlogPosts(limit, offset);
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  });

  // Get current user's blog posts (drafts + published)
  router.get('/my-posts', requireAuth(), async (req, res) => {
    try {
      const posts = await storage.getUserBlogPosts(req.userId!);
      res.json(posts);
    } catch (error) {
      console.error('Error fetching user blog posts:', error);
      res.status(500).json({ error: 'Failed to fetch your blog posts' });
    }
  });

  // Get single blog post by slug
  router.get('/posts/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);

      if (!post) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      // Only allow viewing unpublished posts by their owner
      if (!post.isPublished && post.userId !== req.userId) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      // Increment view count
      await storage.incrementBlogPostViews(post.id);

      res.json(post);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ error: 'Failed to fetch blog post' });
    }
  });

  // Get related posts
  router.get('/posts/:slug/related', async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);

      if (!post) {
        return res.status(404).json({ error: 'Blog post not found' });
      }

      const relatedPosts = await storage.getRelatedBlogPosts(post.category, slug);
      res.json(relatedPosts);
    } catch (error) {
      console.error('Error fetching related posts:', error);
      res.status(500).json({ error: 'Failed to fetch related posts' });
    }
  });

  // Create new blog post (any authenticated user)
  router.post('/posts', requireAuth(), async (req, res) => {
    try {
      const postSchema = z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        excerpt: z.string().min(1),
        content: z.string().min(1),
        category: z.string().min(1),
        tags: z.string().optional(),
        imageUrl: z.string().optional(),
        isPublished: z.boolean().optional().default(false),
      });

      const data = postSchema.parse(req.body);

      // Check slug uniqueness; append timestamp if collision
      const existing = await storage.getBlogPostBySlug(data.slug);
      if (existing) {
        data.slug = `${data.slug}-${Date.now()}`;
      }

      const post = await storage.createBlogPost(req.userId!, data);
      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating blog post:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid blog post data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  // Update own blog post
  router.put('/posts/:id', requireAuth(), async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getBlogPost(id);

      if (!post) {
        return res.status(404).json({ error: 'Blog post not found' });
      }
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updateSchema = z.object({
        title: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        excerpt: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        tags: z.string().optional(),
        imageUrl: z.string().optional(),
        isPublished: z.boolean().optional(),
      });

      const data = updateSchema.parse(req.body);

      // If slug changed, check uniqueness
      if (data.slug && data.slug !== post.slug) {
        const existing = await storage.getBlogPostBySlug(data.slug);
        if (existing) {
          data.slug = `${data.slug}-${Date.now()}`;
        }
      }

      const updated = await storage.updateBlogPost(id, data);
      res.json(updated);
    } catch (error) {
      console.error('Error updating blog post:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid blog post data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update blog post' });
    }
  });

  // Delete own blog post
  router.delete('/posts/:id', requireAuth(), async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getBlogPost(id);

      if (!post) {
        return res.status(404).json({ error: 'Blog post not found' });
      }
      if (post.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await storage.deleteBlogPost(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting blog post:', error);
      res.status(500).json({ error: 'Failed to delete blog post' });
    }
  });

  return router;
}
