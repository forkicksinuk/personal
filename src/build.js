import fs from "fs";
import path from "path";
import { marked } from "marked";
import hljs from "highlight.js";
import ejs from "ejs";

// Configuration
const POSTS_PER_PAGE = 10;
const DOCS_DIR = "./docs";
const DIST_DIR = "./dist";
const TEMPLATES_DIR = "./src/templates";
const STYLES_DIR = "./src/styles";

// Configure marked with highlight.js
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (e) {
        console.error("Highlight error:", e);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: false,
  gfm: true,
});

// Format date to Chinese format
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year} 年 ${month} 月 ${day} 日`;
}

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Clean dist directory
function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, "posts"));
  ensureDir(path.join(DIST_DIR, "page"));
  ensureDir(path.join(DIST_DIR, "assets", "css"));
}

// Copy CSS files
function copyCss() {
  const cssFiles = fs.readdirSync(STYLES_DIR);
  for (const file of cssFiles) {
    if (file.endsWith(".css")) {
      fs.copyFileSync(
        path.join(STYLES_DIR, file),
        path.join(DIST_DIR, "assets", "css", file)
      );
    }
  }
  console.log("CSS files copied.");
}

// Read and parse all posts
function getPosts() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.log("No docs directory found. Creating empty one.");
    ensureDir(DOCS_DIR);
    return [];
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.log("No markdown files found in docs/");
    return [];
  }

  const posts = files.map((file) => {
    const filePath = path.join(DOCS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const stats = fs.statSync(filePath);

    // 标题：直接用文件名（去掉 .md）
    const title = file.replace(".md", "");

    // 使用文件的最后修改时间（mtime）作为日期
    const date = stats.mtime;

    return {
      slug: file.replace(".md", ""),
      title,
      date,
      dateFormatted: formatDate(date),
      html: marked.parse(content), // 直接解析整个内容，无需 gray-matter
    };
  });

  // Sort by date descending (newest first)
  posts.sort((a, b) => b.date - a.date);

  // Add prev/next links
  posts.forEach((post, i) => {
    post.prev = posts[i + 1] || null; // Older post
    post.next = posts[i - 1] || null; // Newer post
  });

  return posts;
}

// Generate post pages
function generatePosts(posts) {
  const template = fs.readFileSync(
    path.join(TEMPLATES_DIR, "post.ejs"),
    "utf-8"
  );

  for (const post of posts) {
    const html = ejs.render(template, { post });
    fs.writeFileSync(path.join(DIST_DIR, "posts", `${post.slug}.html`), html);
  }

  console.log(`Generated ${posts.length} post pages.`);
}

// Generate index pages with pagination
function generateIndex(posts) {
  const template = fs.readFileSync(
    path.join(TEMPLATES_DIR, "index.ejs"),
    "utf-8"
  );

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * POSTS_PER_PAGE;
    const pagePosts = posts.slice(start, start + POSTS_PER_PAGE);

    const html = ejs.render(template, {
      posts: pagePosts,
      currentPage: page,
      totalPages,
    });

    if (page === 1) {
      fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);
    } else {
      fs.writeFileSync(path.join(DIST_DIR, "page", `${page}.html`), html);
    }
  }

  console.log(`Generated ${totalPages} index pages.`);
}

// Main build function
function build() {
  console.log("Building blog...\n");

  // Clean and prepare dist
  cleanDist();

  // Copy CSS
  copyCss();

  // Get all posts
  const posts = getPosts();

  if (posts.length === 0) {
    // Generate empty index page
    generateIndex([]);
    console.log("\nBuild complete! (No posts yet)");
    return;
  }

  // Generate post pages
  generatePosts(posts);

  // Generate index pages
  generateIndex(posts);

  console.log("\nBuild complete!");
}

// Run build
build();
