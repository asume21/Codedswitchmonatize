import { Router } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';

export function createBlogRouter(storage: IStorage) {
  const router = Router();

  // Get all blog posts
  router.get('/posts', async (req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ error: 'Failed to fetch blog posts' });
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

      // Increment view count
      await storage.incrementBlogPostViews(slug);
      
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

  // Create new blog post (admin only)
  router.post('/posts', async (req, res) => {
    try {
      const postSchema = z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        excerpt: z.string().min(1),
        content: z.string().min(1),
        author: z.string().min(1),
        category: z.string().min(1),
        tags: z.array(z.string()),
        imageUrl: z.string().optional(),
      });

      const data = postSchema.parse(req.body);
      const post = await storage.createBlogPost(data);
      
      res.status(201).json(post);
    } catch (error) {
      console.error('Error creating blog post:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid blog post data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create blog post' });
    }
  });

  return router;
}
