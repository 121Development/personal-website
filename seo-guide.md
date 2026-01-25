<!-- Essential meta tags that update per page -->
<title>Erik's Blog - Post Title</title>
<meta name="description" content="...">
<meta name="keywords" content="...">

<!-- Open Graph (social sharing) -->
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:type" content="website">
<meta property="og:url" content="...">
<meta property="og:image" content="...">

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
```

**2. Static Files Needed:**
```
public/
├── robots.txt           # Search engine instructions
├── sitemap.xml          # Auto-generated from GitHub content
├── humans.txt           # Optional, nice touch
└── .well-known/
    └── ai-plugin.json   # For AI agent discovery (OpenAI standard)
```

**3. SEO Challenge with SPA:**
- **Problem**: Hash routing (`#/about`) isn't SEO-friendly - crawlers may not execute JS
- **Solutions**:
  - **Option A**: Add **pre-rendering** during build (generate static HTML snapshots)
  - **Option B**: Use **history API routing** instead of hash routing (requires server config)
  - **Option C**: Add **SSR metadata** in initial HTML with fallback content

**4. LLM/Agent Optimization:**

Create these files:

**`robots.txt`:**
```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

Sitemap: https://yoursite.com/sitemap.xml


sitemap.xml (auto-generated from GitHub content):


<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yoursite.com/</loc>
    <changefreq>weekly</changefreq>
  </url>
  <!-- Auto-generated from blog posts -->
</urlset>


.well-known/ai-plugin.json (for AI agent discovery):
{
  "schema_version": "v1",
  "name_for_human": "Erik's Portfolio",
  "name_for_model": "erik_portfolio",
  "description_for_human": "Security expert, blockchain developer, and system architect",
  "description_for_model": "Access Erik's CV, projects, blog posts about security, blockchain, and software architecture",
  "api": {
    "type": "openapi",
    "url": "https://yoursite.com/openapi.yaml"
  }
}


5. Structured Data (JSON-LD):

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Erik",
  "jobTitle": "Senior Security Advisor",
  "url": "https://yoursite.com",
  "sameAs": [
    "https://github.com/yourusername",
    "https://linkedin.com/in/yourprofile"
  ]
}
</script>
```

**6. Enhanced Project Structure:**
```
homepage/
├── src/
│   ├── seo/
│   │   ├── meta.ts          # Dynamic meta tag manager
│   │   ├── sitemap.ts       # Sitemap generator
│   │   └── structured-data.ts
│   └── ...
├── public/
│   ├── robots.txt
│   └── .well-known/
│       └── ai-plugin.json
└── scripts/
    └── generate-sitemap.ts  # Build-time sitemap generation