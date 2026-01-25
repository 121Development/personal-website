# SEO & GEO Optimization Skill

Use this skill when optimizing a website for Search Engine Optimization (SEO) and Generative Engine Optimization (GEO). This covers both traditional search engines and AI/LLM crawlers.

## Quick Reference

### Files to Create/Modify
- `src/layouts/Layout.astro` or equivalent base layout
- `public/robots.txt`
- `public/.well-known/ai-plugin.json`
- `src/pages/sitemap.xml.ts`
- `src/pages/rss.xml.ts`
- `src/pages/search.json.ts` (optional, for client-side search)
- Individual content pages for article-specific structured data

---

## 1. Meta Tags (Base Layout)

Add comprehensive meta tags to your base layout's `<head>`:

```astro
---
interface Props {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedDate?: string;
  keywords?: string;
}

const {
  title,
  description = "Default site description for SEO",
  image = "/images/og-default.png",
  type = "website",
  publishedDate,
  keywords = "keyword1, keyword2, keyword3"
} = Astro.props;

const siteUrl = "https://yourdomain.com";
const canonicalUrl = new URL(Astro.url.pathname, siteUrl).href;
const ogImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
---

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>

  <!-- Core SEO -->
  <meta name="description" content={description}>
  <meta name="keywords" content={keywords}>
  <meta name="author" content="Your Name">
  <link rel="canonical" href={canonicalUrl}>

  <!-- Robots directives -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow">

  <!-- Favicon set -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

  <!-- RSS Feed discovery -->
  <link rel="alternate" type="application/rss+xml" title="Site RSS" href={`${siteUrl}/rss.xml`}>
</head>
```

---

## 2. Open Graph Tags (Social Sharing)

Add after core meta tags for Facebook, LinkedIn, and general social sharing:

```html
<!-- Open Graph / Facebook -->
<meta property="og:type" content={type}>
<meta property="og:url" content={canonicalUrl}>
<meta property="og:title" content={title}>
<meta property="og:description" content={description}>
<meta property="og:image" content={ogImage}>
<meta property="og:site_name" content="Your Site Name">
<meta property="og:locale" content="en_US">
{publishedDate && <meta property="article:published_time" content={publishedDate} />}
{publishedDate && <meta property="article:author" content="Author Name" />}
```

**Image requirements:**
- Minimum: 1200x630px for large image display
- Keep file size under 300KB for fast loading
- Use PNG or JPG format

---

## 3. Twitter Card Tags

Add for Twitter/X sharing:

```html
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content={canonicalUrl}>
<meta name="twitter:title" content={title}>
<meta name="twitter:description" content={description}>
<meta name="twitter:image" content={ogImage}>
<meta name="twitter:creator" content="@yourusername">
```

---

## 4. Structured Data (JSON-LD)

### Person/Organization Schema (site-wide)

Add to base layout:

```html
<!-- Structured Data - Person -->
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Your Name",
  "url": siteUrl,
  "jobTitle": "Your Job Title",
  "description": "Brief description of who you are",
  "sameAs": [
    "https://twitter.com/yourusername",
    "https://linkedin.com/in/yourusername",
    "https://github.com/yourusername"
  ]
})} />

<!-- Structured Data - Website -->
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Site Name",
  "url": siteUrl,
  "description": description,
  "author": {
    "@type": "Person",
    "name": "Your Name"
  }
})} />
```

### Article/BlogPosting Schema (per-article)

Add to blog post pages:

```astro
---
const articleSchema = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": post.title,
  "description": post.excerpt || post.title,
  "image": ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`,
  "datePublished": post.date,
  "dateModified": post.date,
  "author": {
    "@type": "Person",
    "name": "Your Name",
    "url": siteUrl
  },
  "publisher": {
    "@type": "Person",
    "name": "Your Name",
    "url": siteUrl
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": postUrl
  },
  "url": postUrl
};
---

<article itemscope itemtype="https://schema.org/BlogPosting">
  <meta itemprop="datePublished" content={post.date}>
  <meta itemprop="author" content="Your Name">
  <h1 itemprop="headline">{post.title}</h1>
  <div itemprop="articleBody" set:html={post.content} />
</article>

<script type="application/ld+json" set:html={JSON.stringify(articleSchema)} />
```

---

## 5. robots.txt

Create `public/robots.txt`:

```txt
# robots.txt

User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

# Search Engine Crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Social Media / Messaging Preview Bots
User-agent: WhatsApp
Allow: /

User-agent: Signal
Allow: /

User-agent: TelegramBot
Allow: /

User-agent: Slackbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: LinkedInBot
Allow: /

User-agent: Twitterbot
Allow: /

# AI/LLM Crawlers - Explicitly Allow (GEO)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: CCBot
Allow: /

# Sitemap
Sitemap: https://yourdomain.com/sitemap.xml
```

**Notes:**
- Explicitly allow AI crawlers for GEO (Generative Engine Optimization)
- Allow social media bots for link previews in messaging apps
- Block sensitive paths like `/api/` and `/admin/`

---

## 6. AI Plugin Manifest (GEO)

Create `public/.well-known/ai-plugin.json`:

```json
{
  "schema_version": "v1",
  "name_for_human": "Your Site Name",
  "name_for_model": "your_site_identifier",
  "description_for_human": "Brief description for humans",
  "description_for_model": "Detailed description for AI models explaining what content is available, topics covered, and how the site can be useful. Include keywords and context that help AI understand your site.",
  "auth": {
    "type": "none"
  },
  "api": {
    "type": "openapi",
    "url": "https://yourdomain.com/openapi.yaml",
    "is_user_authenticated": false
  },
  "logo_url": "https://yourdomain.com/images/logo.png",
  "contact_email": "contact@yourdomain.com",
  "legal_info_url": "https://yourdomain.com/about"
}
```

**Purpose:** Enables AI agents to discover and understand your site's purpose and content.

---

## 7. XML Sitemap

Create `src/pages/sitemap.xml.ts`:

```typescript
import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const siteUrl = 'https://yourdomain.com';
  const posts = await fetchBlogPosts();

  const staticPages = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/about', changefreq: 'monthly', priority: '0.8' },
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
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

**Priority guidelines:**
- `1.0` - Homepage
- `0.9` - Main content hubs (blog index)
- `0.8` - Important static pages (about, services)
- `0.7` - Individual content pages (blog posts)
- `0.6` - Less important pages (contact)

---

## 8. RSS Feed

Create `src/pages/rss.xml.ts`:

```typescript
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await fetchBlogPosts();

  return rss({
    title: 'Your Site Name',
    description: 'Site description for feed readers',
    site: context.site || 'https://yourdomain.com',
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.excerpt || '',
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>
<copyright>Copyright ${new Date().getFullYear()} Your Name</copyright>
<managingEditor>email@yourdomain.com (Your Name)</managingEditor>
<category>Your Category</category>`,
  });
}
```

**Install dependency:**
```bash
npm install @astrojs/rss
```

---

## 9. Search Index (Optional)

Create `src/pages/search.json.ts` for client-side search:

```typescript
import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await fetchBlogPosts();

  const searchIndex = posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt || '',
    content: post.content
      .replace(/<[^>]*>/g, ' ')  // Strip HTML
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500),  // Limit for index size
    url: `/blog/${post.slug}`,
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## 10. Astro Configuration

Ensure `astro.config.mjs` has the site URL:

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yourdomain.com',
  // ... other config
});
```

---

## Checklist

### Core SEO
- [ ] Title tags on all pages (unique, descriptive, 50-60 chars)
- [ ] Meta descriptions (unique, compelling, 150-160 chars)
- [ ] Canonical URLs on all pages
- [ ] Proper heading hierarchy (h1 > h2 > h3)
- [ ] Alt text on images
- [ ] Mobile-responsive design
- [ ] Fast page load times

### Technical SEO
- [ ] XML sitemap generated and submitted
- [ ] robots.txt configured
- [ ] RSS feed available
- [ ] Favicon set (ico, png, apple-touch-icon)
- [ ] HTTPS enabled
- [ ] Clean URL structure

### Social/Link Previews
- [ ] Open Graph tags (og:title, og:description, og:image, og:url)
- [ ] Twitter Card tags
- [ ] OG image optimized (1200x630px, <300KB)
- [ ] Social bots allowed in robots.txt

### Structured Data
- [ ] Person/Organization schema on all pages
- [ ] WebSite schema on homepage
- [ ] Article/BlogPosting schema on blog posts
- [ ] Validate with Google Rich Results Test

### GEO (AI Optimization)
- [ ] AI crawlers allowed in robots.txt (GPTBot, Claude-Web, etc.)
- [ ] ai-plugin.json manifest in .well-known
- [ ] Clear, descriptive content (AI-readable)
- [ ] Semantic HTML structure

---

## Testing Tools

- **Google Search Console** - Index coverage, search performance
- **Google Rich Results Test** - Validate structured data
- **Facebook Sharing Debugger** - Test Open Graph tags
- **Twitter Card Validator** - Test Twitter cards
- **Lighthouse** - Performance, SEO audit
- **Schema.org Validator** - Validate JSON-LD

---

## Common Issues

### Link previews not showing in messaging apps
1. Check robots.txt allows social bots (WhatsApp, Signal, facebookexternalhit)
2. Verify og:image is absolute URL and accessible
3. Image must be under 5MB, ideally under 300KB
4. Clear cache in messaging apps (send new URL variant with ?v=2)

### Pages not indexed
1. Check robots.txt isn't blocking
2. Verify sitemap includes the page
3. Check for noindex meta tag
4. Submit URL in Google Search Console

### Structured data errors
1. Validate with Rich Results Test
2. Ensure all required properties are present
3. Use absolute URLs for images
4. Check date format (ISO 8601)

### AI crawlers blocked
1. Don't block GPTBot, Claude-Web, etc. in robots.txt
2. Avoid aggressive rate limiting
3. Ensure content is in HTML (not just JavaScript)
