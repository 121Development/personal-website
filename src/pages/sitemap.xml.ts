import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const siteUrl = 'https://121eliasson.com';
  const posts = await fetchBlogPosts();

  const staticPages = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/about', changefreq: 'monthly', priority: '0.8' },
    { url: '/cv', changefreq: 'monthly', priority: '0.8' },
    { url: '/projects', changefreq: 'monthly', priority: '0.7' },
    { url: '/blog', changefreq: 'daily', priority: '0.9' },
    { url: '/contact', changefreq: 'monthly', priority: '0.6' },
  ];

  const blogPages = posts.map((post) => ({
    url: `/blog/${post.slug}`,
    changefreq: 'monthly',
    priority: '0.7',
    lastmod: post.date,
  }));

  const allPages = [...staticPages, ...blogPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${allPages.map(page => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${page.lastmod ? `
    <lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}
