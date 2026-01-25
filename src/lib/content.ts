import type { BlogPost, ContentSection } from './types';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONTENT_DIR = join(process.cwd(), 'content');

/**
 * Read all files from a directory
 */
async function readDirectory(path: string): Promise<string[]> {
  try {
    const files = await readdir(join(CONTENT_DIR, path));
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error(`Error reading directory ${path}:`, error);
    return [];
  }
}

/**
 * Read content from a file
 */
async function readContentFile(path: string): Promise<string> {
  try {
    return await readFile(join(CONTENT_DIR, path), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${path}`);
  }
}

/**
 * Fetch all blog posts from the blog directory
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const files = await readDirectory('blog');
    
    const posts = await Promise.all(
      files.map(async (filename) => {
        const content = await readContentFile(`blog/${filename}`);
        const slug = filename.replace('.md', '');
        
        // Extract date from filename (format: YYYY-MM-DD-title.md)
        const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
        const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
        const title = dateMatch ? dateMatch[2].replace(/-/g, ' ') : slug.replace(/-/g, ' ');
        
        // Extract first paragraph as excerpt
        const excerpt = content.split('\n\n')[0].replace(/^#.*\n/, '').trim();
        
        return {
          slug,
          title,
          date,
          content,
          excerpt
        };
      })
    );
    
    // Sort by date, newest first
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

/**
 * Fetch a single blog post by slug
 */
export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const content = await readContentFile(`blog/${slug}.md`);
    
    const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    const title = dateMatch ? dateMatch[2].replace(/-/g, ' ') : slug.replace(/-/g, ' ');
    
    return {
      slug,
      title,
      date,
      content
    };
  } catch (error) {
    console.error(`Error fetching blog post ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch content from a markdown file (about, cv, contact, etc.)
 */
export async function fetchContentSection(filename: string): Promise<ContentSection | null> {
  try {
    const content = await readContentFile(filename);
    
    // Extract title from first H1 if present
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
    
    return {
      title,
      content
    };
  } catch (error) {
    console.error(`Error fetching content section ${filename}:`, error);
    return null;
  }
}

/**
 * Fetch all projects from the projects directory
 */
export async function fetchProjects() {
  try {
    const files = await readDirectory('projects');
    
    const projects = await Promise.all(
      files.map(async (filename) => {
        const content = await readContentFile(`projects/${filename}`);
        const name = filename.replace('.md', '');
        
        return {
          name,
          content
        };
      })
    );
    
    return projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}
