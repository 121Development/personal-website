import type { BlogPost, ContentSection } from './types';
import { marked } from 'marked';

// Configure marked for clean output
marked.setOptions({
  breaks: true,
  gfm: true
});

// Use Astro's import.meta.glob for build-time file reading
const blogFiles = import.meta.glob('/content/blog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const projectFiles = import.meta.glob('/content/projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const contentFiles = import.meta.glob('/content/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/**
 * Parse markdown to HTML
 */
function parseMarkdown(content: string): string {
  return marked.parse(content) as string;
}

/**
 * Fetch all blog posts from the blog directory
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const posts = Object.entries(blogFiles).map(([path, rawContent]) => {
    const filename = path.split('/').pop()!;
    const slug = filename.replace('.md', '');

    // Extract date from filename (format: YYYY-MM-DD-title.md)
    const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    const title = dateMatch
      ? dateMatch[2].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : slug.replace(/-/g, ' ');

    // Extract first paragraph as excerpt (skip H1 and images)
    const lines = rawContent.split('\n\n');
    const excerptRaw = lines.find(line => line.trim() && !line.startsWith('#') && !line.startsWith('![')) || '';
    const excerpt = excerptRaw.replace(/[*_`]/g, '').trim();

    // Extract first image from markdown
    const imageMatch = rawContent.match(/!\[.*?\]\((.*?)\)/);
    const image = imageMatch ? imageMatch[1] : undefined;

    return {
      slug,
      title,
      date,
      content: parseMarkdown(rawContent),
      excerpt,
      image
    };
  });

  // Sort by date, newest first
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Fetch a single blog post by slug
 */
export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  const path = `/content/blog/${slug}.md`;
  const rawContent = blogFiles[path];

  if (!rawContent) return null;

  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  const title = dateMatch
    ? dateMatch[2].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : slug.replace(/-/g, ' ');

  return {
    slug,
    title,
    date,
    content: parseMarkdown(rawContent)
  };
}

/**
 * Fetch content from a markdown file (about, cv, contact, etc.)
 */
export async function fetchContentSection(filename: string): Promise<ContentSection | null> {
  const path = `/content/${filename}`;
  const rawContent = contentFiles[path];

  if (!rawContent) return null;

  // Extract title from first H1 if present
  const titleMatch = rawContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');

  return {
    title,
    content: parseMarkdown(rawContent)
  };
}

/**
 * Fetch all projects from the projects directory
 */
export async function fetchProjects() {
  return Object.entries(projectFiles).map(([path, rawContent]) => {
    const filename = path.split('/').pop()!;
    const name = filename.replace('.md', '');

    return {
      name,
      content: parseMarkdown(rawContent)
    };
  });
}
