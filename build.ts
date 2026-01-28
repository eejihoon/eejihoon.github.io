import { readdir, mkdir, rm, cp } from "node:fs/promises";
import { join, basename } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = "./content";
const TEMPLATES_DIR = "./templates";
const STATIC_DIR = "./static";
const DIST_DIR = "./dist";

interface Post {
  slug: string;
  title: string;
  date: Date;
  content: string;
  html: string;
  toc: string;
  summary?: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/(^-|-$)/g, "");
}

function generateTocAndHtml(body: string, rawHtml: string): { toc: string; html: string } {
  const headings: { level: number; text: string; id: string }[] = [];
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(body)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugify(text);
    headings.push({ level, text, id });
  }

  // Add IDs to headings in HTML
  let html = rawHtml;
  for (const h of headings) {
    const regex = new RegExp(`<h${h.level}>([^<]*${h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*)</h${h.level}>`);
    html = html.replace(regex, `<h${h.level} id="${h.id}">$1</h${h.level}>`);
  }

  // Generate TOC
  if (headings.length === 0) return { toc: "", html };
  const tocItems = headings.map(h =>
    `<li style="margin-left:${(h.level - 2) * 1}em"><a href="#${h.id}">${h.text}</a></li>`
  ).join("\n");
  const toc = `<nav class="toc"><strong>목차</strong><ul>${tocItems}</ul></nav>`;

  return { toc, html };
}

async function readTemplate(name: string): Promise<string> {
  return Bun.file(join(TEMPLATES_DIR, name)).text();
}

function parseToml(s: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of s.split("\n")) {
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (match) {
      const [, key, rawValue] = match;
      let value = rawValue.trim();
      // Remove quotes and parse value
      if (value.startsWith("'") && value.endsWith("'")) {
        result[key] = value.slice(1, -1);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1);
      } else if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else if (value.startsWith("[") && value.endsWith("]")) {
        // Simple array parsing
        const inner = value.slice(1, -1);
        result[key] = inner.split(",").map((v) => {
          v = v.trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            return v.slice(1, -1);
          }
          return v;
        });
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

async function parseMarkdown(filePath: string): Promise<Post | null> {
  const content = await Bun.file(filePath).text();

  // Detect frontmatter type
  const isToml = content.startsWith("+++");
  const options = isToml
    ? {
        delimiters: ["+++", "+++"] as [string, string],
        language: "toml" as const,
        engines: { toml: parseToml },
      }
    : {};

  const { data, content: body } = matter(content, options);

  // Skip drafts
  if (data.draft === true) {
    return null;
  }

  const slug = basename(filePath, ".md");
  const rawHtml = await marked(body);
  const { toc, html } = generateTocAndHtml(body, rawHtml);

  return {
    slug,
    title: data.title || slug,
    date: new Date(data.date || Date.now()),
    content: body,
    html,
    toc,
    summary: data.summary,
  };
}

async function getPosts(): Promise<Post[]> {
  const postsDir = join(CONTENT_DIR, "posts");
  const files = await readdir(postsDir);
  const posts: Post[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const post = await parseMarkdown(join(postsDir, file));
    if (post) {
      posts.push(post);
    }
  }

  // Sort by date, newest first
  return posts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

async function getAbout(): Promise<{ html: string; title: string } | null> {
  try {
    const content = await Bun.file(join(CONTENT_DIR, "about.md")).text();
    const { data, content: body } = matter(content);
    const html = await marked(body);
    return { html, title: data.title || "About" };
  } catch {
    return null;
  }
}

function applyTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function build() {
  console.log("Building site...");

  // Clean dist
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  await mkdir(join(DIST_DIR, "posts"), { recursive: true });

  // Load templates
  const baseTemplate = await readTemplate("base.html");
  const postTemplate = await readTemplate("post.html");
  const indexTemplate = await readTemplate("index.html");

  // Get content
  const posts = await getPosts();
  const about = await getAbout();

  console.log(`Found ${posts.length} posts`);

  // Build post pages
  for (const post of posts) {
    const postContent = applyTemplate(postTemplate, {
      title: post.title,
      date: formatDate(post.date),
      toc: post.toc,
      content: post.html,
    });

    const html = applyTemplate(baseTemplate, {
      title: `${post.title} | --verbose`,
      content: postContent,
    });

    const postDir = join(DIST_DIR, "posts", post.slug);
    await mkdir(postDir, { recursive: true });
    await Bun.write(join(postDir, "index.html"), html);
  }

  // Build index page
  const postListHtml = posts
    .map((post) => `<li><time>${formatDate(post.date)}</time> <a href="/posts/${post.slug}/">${post.title}</a></li>`)
    .join("\n");

  const indexContent = applyTemplate(indexTemplate, { postList: postListHtml });
  const indexHtml = applyTemplate(baseTemplate, { title: "--verbose", content: indexContent });
  await Bun.write(join(DIST_DIR, "index.html"), indexHtml);

  // Build about page
  if (about) {
    const aboutHtml = applyTemplate(baseTemplate, { title: "about", content: about.html });
    await mkdir(join(DIST_DIR, "about"), { recursive: true });
    await Bun.write(join(DIST_DIR, "about", "index.html"), aboutHtml);
  }

  // Copy static files
  try {
    await cp(STATIC_DIR, DIST_DIR, { recursive: true });
  } catch {
    console.log("No static directory found, skipping...");
  }

  console.log("Build complete!");
}

// Watch mode
if (process.argv.includes("--watch")) {
  console.log("Watching for changes...");
  await build();

  const watcher = Bun.spawn(["fswatch", "-r", CONTENT_DIR, TEMPLATES_DIR, STATIC_DIR], {
    stdout: "pipe",
  });

  const reader = watcher.stdout.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(`Change detected: ${decoder.decode(value).trim()}`);
    await build();
  }
} else {
  await build();
}
