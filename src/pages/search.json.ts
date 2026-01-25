import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await fetchBlogPosts();

  const searchIndex = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt || '',
    // Strip HTML tags from content for search
    content: post.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500), // Limit content for index size
    image: post.image,
    url: `/blog/${post.slug}`,
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
