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
 * Parse frontmatter from markdown content
 * Returns { frontmatter, content } where content has frontmatter removed
 */
function parseFrontmatter(rawContent: string): { frontmatter: Record<string, unknown>; content: string } {
  const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, content: rawContent };
  }

  const frontmatterStr = frontmatterMatch[1];
  const content = frontmatterMatch[2];
  const frontmatter: Record<string, unknown> = {};

  // Parse simple YAML-like frontmatter
  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Parse array values like [tag1, tag2] or - tag1 format
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim());
    }

    frontmatter[key] = value;
  }

  return { frontmatter, content };
}

/**
 * Fetch all blog posts from the blog directory
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const posts = Object.entries(blogFiles).map(([path, rawContent]) => {
    const filename = path.split('/').pop()!;
    const slug = filename.replace('.md', '');

    // Parse frontmatter
    const { frontmatter, content: contentWithoutFrontmatter } = parseFrontmatter(rawContent);
    const tags = (frontmatter.tags as string[] | undefined) || [];

    // Extract date from filename (format: YYYY-MM-DD-title.md)
    const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    // Extract title from first H1 in content, fallback to slug-based title
    const h1Match = contentWithoutFrontmatter.match(/^#\s+(.+)$/m);
    const title = h1Match
      ? h1Match[1].trim()
      : dateMatch
        ? dateMatch[2].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        : slug.replace(/-/g, ' ');

    // Remove the first H1 from content to avoid duplicate headers
    const contentWithoutH1 = contentWithoutFrontmatter.replace(/^#\s+.+\n*/m, '');

    // Extract first paragraph as excerpt (skip H1 and images)
    const lines = contentWithoutH1.split('\n\n');
    const excerptRaw = lines.find(line => line.trim() && !line.startsWith('#') && !line.startsWith('![')) || '';
    const excerpt = excerptRaw.replace(/[*_`]/g, '').trim();

    // Extract first image from markdown
    const imageMatch = contentWithoutFrontmatter.match(/!\[.*?\]\((.*?)\)/);
    const image = imageMatch ? imageMatch[1] : undefined;

    return {
      slug,
      title,
      date,
      content: parseMarkdown(contentWithoutH1),
      excerpt,
      image,
      tags
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

  // Parse frontmatter
  const { frontmatter, content: contentWithoutFrontmatter } = parseFrontmatter(rawContent);
  const tags = (frontmatter.tags as string[] | undefined) || [];

  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // Extract title from first H1 in content, fallback to slug-based title
  const h1Match = contentWithoutFrontmatter.match(/^#\s+(.+)$/m);
  const title = h1Match
    ? h1Match[1].trim()
    : dateMatch
      ? dateMatch[2].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : slug.replace(/-/g, ' ');

  // Remove the first H1 from content to avoid duplicate headers
  const contentWithoutH1 = contentWithoutFrontmatter.replace(/^#\s+.+\n*/m, '');

  // Extract first image from markdown
  const imageMatch = contentWithoutFrontmatter.match(/!\[.*?\]\((.*?)\)/);
  const image = imageMatch ? imageMatch[1] : undefined;

  // Extract excerpt
  const lines = contentWithoutH1.split('\n\n');
  const excerptRaw = lines.find(line => line.trim() && !line.startsWith('#') && !line.startsWith('![')) || '';
  const excerpt = excerptRaw.replace(/[*_`]/g, '').trim();

  return {
    slug,
    title,
    date,
    content: parseMarkdown(contentWithoutH1),
    excerpt,
    image,
    tags
  };
}

/**
 * Get all unique tags from blog posts
 */
export async function fetchAllTags(): Promise<string[]> {
  const posts = await fetchBlogPosts();
  const tagSet = new Set<string>();

  for (const post of posts) {
    if (post.tags) {
      for (const tag of post.tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
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
