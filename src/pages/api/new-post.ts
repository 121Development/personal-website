import type { APIRoute } from 'astro';

export const prerender = false;

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

// GitHub API helper with retry logic
async function githubAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: object,
  retries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // If rate limited, wait and retry
      if (response.status === 403 || response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err as Error;
      if (i < retries - 1) {
        const delay = Math.pow(2, i + 1) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('GitHub API request failed');
}

function generateSlug(title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/-$/, '');

  return `${date}-${titleSlug}`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Rate limiting
  const ip = clientAddress || 'unknown';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { password, title, content, tags, featured, image } = body;

    // Get environment variables
    const env = (import.meta as any).env || process.env;
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const GITHUB_OWNER = env.GITHUB_OWNER;
    const GITHUB_REPO = env.GITHUB_REPO;
    const GITHUB_BRANCH = env.GITHUB_BRANCH || 'master';

    // Validate password
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate environment
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing GitHub settings' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const slug = generateSlug(title);
    const commits: Array<{ path: string; content: string }> = [];

    // Process image if provided
    let imagePath = '';
    if (image && image.base64) {
      const imageFilename = `${slug}.${image.format || 'webp'}`;
      imagePath = `/images/blog/${imageFilename}`;

      commits.push({
        path: `public${imagePath}`,
        content: image.base64,
      });
    }

    // Generate markdown content
    const frontmatter = [
      '---',
      `tags: [${tags?.join(', ') || ''}]`,
    ];

    if (featured) {
      frontmatter.push('featured: true');
    }

    frontmatter.push('---');

    let markdownContent = frontmatter.join('\n') + '\n\n';
    markdownContent += `# ${title}\n\n`;

    if (imagePath) {
      markdownContent += `![](${imagePath})\n\n`;
    }

    markdownContent += content;

    commits.push({
      path: `content/blog/${slug}.md`,
      content: Buffer.from(markdownContent).toString('base64'),
    });

    // Get current commit SHA (needed for creating new commits)
    const refResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN
    );

    if (!refResponse.ok) {
      const error = await refResponse.text();
      throw new Error(`Failed to get branch ref: ${error}`);
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Get base tree
    const baseCommitResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${baseSha}`,
      GITHUB_TOKEN
    );

    if (!baseCommitResponse.ok) {
      throw new Error('Failed to get base commit');
    }

    const baseCommit = await baseCommitResponse.json();
    const baseTreeSha = baseCommit.tree.sha;

    // Create blobs for each file
    const treeItems = [];

    for (const commit of commits) {
      const blobResponse = await githubAPI(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
        GITHUB_TOKEN,
        'POST',
        {
          content: commit.content,
          encoding: 'base64',
        }
      );

      if (!blobResponse.ok) {
        const error = await blobResponse.text();
        throw new Error(`Failed to create blob for ${commit.path}: ${error}`);
      }

      const blob = await blobResponse.json();

      treeItems.push({
        path: commit.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    // Create tree
    const treeResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
      GITHUB_TOKEN,
      'POST',
      {
        base_tree: baseTreeSha,
        tree: treeItems,
      }
    );

    if (!treeResponse.ok) {
      const error = await treeResponse.text();
      throw new Error(`Failed to create tree: ${error}`);
    }

    const tree = await treeResponse.json();

    // Create commit
    const commitResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
      GITHUB_TOKEN,
      'POST',
      {
        message: `Add blog post: ${title}`,
        tree: tree.sha,
        parents: [baseSha],
      }
    );

    if (!commitResponse.ok) {
      const error = await commitResponse.text();
      throw new Error(`Failed to create commit: ${error}`);
    }

    const newCommit = await commitResponse.json();

    // Update branch reference
    const updateRefResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN,
      'PATCH',
      {
        sha: newCommit.sha,
      }
    );

    if (!updateRefResponse.ok) {
      const error = await updateRefResponse.text();
      throw new Error(`Failed to update branch: ${error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        message: 'Post created successfully. Site will rebuild automatically.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error creating post:', err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
