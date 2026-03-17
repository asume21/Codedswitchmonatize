import { getAIClient } from './grok';

interface BlogPostRequest {
  keyword: string;
  targetWordCount: number;
  tone?: string;
  includeExamples?: boolean;
}

export async function generateSEOBlogPost(request: BlogPostRequest): Promise<string> {
  const { keyword, targetWordCount, tone = 'professional and friendly', includeExamples = true } = request;

  const prompt = `Write a comprehensive, SEO-optimized blog post about "${keyword}".

Requirements:
- Target word count: ${targetWordCount} words
- Tone: ${tone}
- Include practical examples: ${includeExamples ? 'yes' : 'no'}
- Format: HTML with proper heading tags (h2, h3, p, ul, ol)
- SEO optimized: Use the keyword naturally throughout
- Include: Introduction, main content sections, conclusion, FAQ section
- Make it engaging and valuable for readers
- Include specific steps and actionable advice
- Add code examples or screenshots descriptions where relevant
- End with a strong call-to-action

Structure:
1. Compelling introduction (hook + problem + solution)
2. 5-7 main sections with h2 headings
3. Subsections with h3 headings where needed
4. Bullet points and numbered lists for readability
5. FAQ section with 5-10 common questions
6. Strong conclusion with CTA

Focus on CodedSwitch as the solution - it's a free online AI-powered music production platform with:
- AI beat generation
- AI lyrics writing
- Professional mixing tools
- Real-time collaboration
- No downloads required
- Completely free

Write the blog post now:`;

  try {
    const aiClient = getAIClient();
    const response = await aiClient.chat.completions.create({
      model: 'grok-2-1212',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO content writer specializing in music production and technology. Write engaging, informative, and well-structured blog posts that rank well on Google while providing genuine value to readers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating blog post:', error);
    throw new Error('Failed to generate blog post with AI');
  }
}

export async function generateBlogPostMetadata(title: string, content: string) {
  const prompt = `Given this blog post title and content, generate SEO metadata:

Title: ${title}

Content: ${content.substring(0, 500)}...

Generate:
1. SEO-optimized meta description (150-160 characters)
2. 5-10 relevant tags
3. Suggested slug (URL-friendly)
4. Excerpt (200 characters)
5. Estimated read time in minutes

Return as JSON.`;

  try {
    const aiClient = getAIClient();
    const response = await aiClient.chat.completions.create({
      model: 'grok-2-1212',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    const result = response.choices[0]?.message?.content || '{}';
    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      metaDescription: title.substring(0, 160),
      tags: ['music production', 'tutorial'],
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      excerpt: content.substring(0, 200),
      readTime: Math.ceil(content.split(' ').length / 200)
    };
  }
}
