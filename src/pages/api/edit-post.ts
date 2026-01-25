import type { APIRoute } from 'astro';

export const prerender = false;

// Convert string to base64 (Workers-compatible, handles UTF-8)
function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Simple in-memory failed attempt counter
const failedAttempts = new Map<string, number>();
const MAX_ATTEMPTS = 2;

// GitHub API helper
async function githubAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: object
): Promise<Response> {
  return await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': '121eliasson-blog',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Check if site is locked by reading locked.md from GitHub
async function isLocked(owner: string, repo: string, branch: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/locked.md?t=${Date.now()}`
    );
    if (!response.ok) return false;
    const content = await response.text();
    return content.trim() === '1';
  } catch {
    return false;
  }
}

// Lock the site by committing "1" to locked.md
async function lockSite(owner: string, repo: string, branch: string, token: string): Promise<void> {
  try {
    const fileResponse = await githubAPI(
      `/repos/${owner}/${repo}/contents/locked.md?ref=${branch}`,
      token
    );

    if (!fileResponse.ok) return;

    const fileData = await fileResponse.json();

    await githubAPI(
      `/repos/${owner}/${repo}/contents/locked.md`,
      token,
      'PUT',
      {
        message: 'Lock site: too many failed password attempts',
        content: btoa('1'),
        sha: fileData.sha,
        branch: branch,
      }
    );
  } catch (err) {
    console.error('Failed to lock site:', err);
  }
}

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  const ip = clientAddress || 'unknown';

  // Get environment variables
  const runtime = (locals as any).runtime;
  const cfEnv = runtime?.env || {};
  const ADMIN_PASSWORD = cfEnv.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD;
  const GITHUB_TOKEN = cfEnv.GITHUB_TOKEN || import.meta.env.GITHUB_TOKEN;
  const GITHUB_OWNER = cfEnv.GITHUB_OWNER || import.meta.env.GITHUB_OWNER;
  const GITHUB_REPO = cfEnv.GITHUB_REPO || import.meta.env.GITHUB_REPO;
  const GITHUB_BRANCH = cfEnv.GITHUB_BRANCH || import.meta.env.GITHUB_BRANCH || 'master';

  // Check if site is locked
  if (await isLocked(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH)) {
    return new Response(
      JSON.stringify({ error: 'Site is locked. Contact admin.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { password, slug, title, content, tags, featured, image } = body;

    // Validate password
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      const attempts = (failedAttempts.get(ip) || 0) + 1;
      failedAttempts.set(ip, attempts);

      // Lock site after 2 failed attempts
      if (attempts >= MAX_ATTEMPTS) {
        await lockSite(GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN);
        return new Response(
          JSON.stringify({ error: 'Too many failed attempts. Site is now locked.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Invalid password',
          attemptsRemaining: MAX_ATTEMPTS - attempts
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Password correct - clear failed attempts
    failedAttempts.delete(ip);

    // Validate required fields
    if (!slug || !title || !content) {
      return new Response(
        JSON.stringify({ error: 'Slug, title and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate environment
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const commits: Array<{ path: string; content: string }> = [];

    // Process new image if provided
    let imagePath = '';
    if (image && image.base64) {
      const imageFilename = `${slug}.${image.format || 'webp'}`;
      imagePath = `/images/blog/${imageFilename}`;
      commits.push({
        path: `public${imagePath}`,
        content: image.base64,
      });
    }

    // Generate updated markdown content
    const frontmatter = ['---', `tags: [${tags?.join(', ') || ''}]`];
    if (featured) frontmatter.push('featured: true');
    frontmatter.push('---');

    let markdownContent = frontmatter.join('\n') + '\n\n';
    markdownContent += `# ${title}\n\n`;
    if (imagePath) markdownContent += `![](${imagePath})\n\n`;
    markdownContent += content;

    commits.push({
      path: `content/blog/${slug}.md`,
      content: stringToBase64(markdownContent),
    });

    // Get current commit SHA
    const refResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN
    );

    if (!refResponse.ok) {
      throw new Error('Failed to get branch ref');
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

    // Create blobs
    const treeItems = [];
    for (const commit of commits) {
      const blobResponse = await githubAPI(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
        GITHUB_TOKEN,
        'POST',
        { content: commit.content, encoding: 'base64' }
      );

      if (!blobResponse.ok) {
        throw new Error(`Failed to create blob for ${commit.path}`);
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
      { base_tree: baseTreeSha, tree: treeItems }
    );

    if (!treeResponse.ok) {
      throw new Error('Failed to create tree');
    }

    const tree = await treeResponse.json();

    // Create commit
    const commitResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
      GITHUB_TOKEN,
      'POST',
      { message: `Update blog post: ${title}`, tree: tree.sha, parents: [baseSha] }
    );

    if (!commitResponse.ok) {
      throw new Error('Failed to create commit');
    }

    const newCommit = await commitResponse.json();

    // Update branch
    const updateRefResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN,
      'PATCH',
      { sha: newCommit.sha }
    );

    if (!updateRefResponse.ok) {
      throw new Error('Failed to update branch');
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        message: 'Post updated successfully.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error updating post:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
