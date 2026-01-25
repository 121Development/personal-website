# Erik's Homepage

Minimal, TypeScript-based homepage built with Astro and deployed to Cloudflare Workers. All content is managed in the same repository.

## Architecture

- **Frontend**: Astro (TypeScript, SSG)
- **Deployment**: Cloudflare Workers
- **Content**: Markdown files in `/content` directory
- **CI/CD**: GitHub Actions

## Quick Start

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build and deploy
pnpm deploy
```

## Content Structure

All content lives in the `/content` directory:

```
content/
├── about.md
├── cv.md
├── contact.md
├── projects/
│   ├── stagtrace.md
│   ├── iamconsistent.md
│   └── ...
└── blog/
    ├── 2025-01-25-first-post.md
    ├── 2025-01-26-second-post.md
    └── ...
```

### Blog Post Format

**Filename**: `YYYY-MM-DD-title-slug.md`

Example: `2025-01-25-building-with-astro.md`

The date and title are automatically extracted from the filename.

### Projects Format

**Filename**: `project-name.md`

Just write markdown - the project name comes from the filename.

### Simple Pages (About, CV, Contact)

Just write markdown. First H1 becomes the page title.

## Setup & Configuration

### 1. Update Site Configuration

**`astro.config.mjs`:**
```javascript
site: 'https://yoursite.com', // Update with your domain
```

**`wrangler.jsonc`:**
```json
"name": "your-site-name"  // Update with your preferred Worker name
```

**`public/robots.txt`:**
Update the sitemap URL with your actual domain.

### 2. GitHub Secrets

In your repository Settings → Secrets and variables → Actions, add:

- `CLOUDFLARE_API_TOKEN` - Get from Cloudflare dashboard
- `CLOUDFLARE_ACCOUNT_ID` - Get from Cloudflare dashboard

### 3. Deploy

Push to `master` branch or run:
```bash
pnpm deploy
```

## Workflow

1. **Edit content**: Add/edit markdown files in `/content`
2. **Commit & push**: Push to main branch
3. **Auto-deploy**: GitHub Actions builds and deploys to Cloudflare Workers
4. **Live in ~2 minutes**

## Project Structure

```
homepage/
├── content/                # All content (markdown)
│   ├── about.md
│   ├── cv.md
│   ├── contact.md
│   ├── projects/
│   └── blog/
├── src/
│   ├── pages/             # Astro pages
│   ├── layouts/           # Base layout
│   └── lib/
│       ├── content.ts     # Content loader
│       └── types.ts       # TypeScript types
├── public/
│   ├── robots.txt
│   └── .well-known/
│       └── ai-plugin.json
├── .github/
│   └── workflows/
│       └── deploy.yml     # CI/CD
├── astro.config.mjs
├── wrangler.jsonc
└── package.json
```

## SEO & GEO (Generative Engine Optimization)

The site is fully optimized for both traditional search engines and AI/LLM crawlers.

### Meta Tags (per page)
- **Basic**: title, description, keywords, author, canonical URL
- **Open Graph**: type, url, title, description, image, site_name, locale
- **Twitter Cards**: card, url, title, description, image, creator
- **Robots**: Enhanced directives (max-image-preview, max-snippet, max-video-preview)

### Structured Data (JSON-LD)
- **Person schema**: Author info, job title, social profiles
- **WebSite schema**: Site metadata
- **BlogPosting schema**: Per-article with headline, author, dates, images
- **Microdata**: Semantic HTML attributes (itemscope, itemprop)

### Static SEO Files
```
public/
├── robots.txt              # Search engine & AI crawler instructions
├── humans.txt              # Site credits and info
├── sitemap.xml             # Auto-generated (dynamic)
├── rss.xml                 # RSS feed for subscribers
└── .well-known/
    └── ai-plugin.json      # AI agent discovery (OpenAI standard)
```

### AI/LLM Crawler Support
The `robots.txt` explicitly allows major AI crawlers:
- GPTBot, ChatGPT-User (OpenAI)
- Claude-Web, anthropic-ai (Anthropic)
- Google-Extended, Googlebot
- PerplexityBot, Bytespider, CCBot

### RSS Feed
Available at `/rss.xml` with all blog posts, categories, and proper metadata.

### Sitemap
Dynamic sitemap at `/sitemap.xml` includes:
- All static pages with priority and change frequency
- All blog posts with last modification dates

## Customization

### Styling

All styles are in `src/layouts/Layout.astro`. Modify the `<style>` block.

### Add New Pages

1. Create markdown file in `/content` (e.g., `skills.md`)
2. Create page in `src/pages/` (e.g., `skills.astro`)
3. Use `fetchContentSection('skills.md')` to load content
4. Add link to navigation in `Layout.astro`

## Development Commands

```bash
pnpm dev      # Start dev server (localhost:4321)
pnpm build    # Build for production
pnpm preview  # Preview production build locally
pnpm deploy   # Build and deploy to Cloudflare Workers
```

## Troubleshooting

### Content not loading
- Ensure markdown files are in `/content` directory
- Check file naming (blog posts must be `YYYY-MM-DD-title.md`)
- Check console for errors

### Deployment fails
- Verify Cloudflare secrets are set correctly
- Check GitHub Actions logs
- Ensure `wrangler.jsonc` name is unique

### Build errors
- Run `pnpm install` to clean install dependencies
- Check TypeScript errors with `pnpm build`

## What's Next?

This is a minimal setup focused on functionality. You can:

1. Enhance the design/styling
2. Add markdown processing (syntax highlighting, etc.)
3. Add analytics (Cloudflare Web Analytics recommended)
4. Add search functionality
5. Add comments (Giscus, utterances)
6. Add dark/light mode toggle (already implemented)

## License

MIT
