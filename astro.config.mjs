import { defineConfig } from "astro/config";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";

export default defineConfig({
  site: "https://eejihoon.github.io",
  output: "static",
  outDir: "./dist",
  publicDir: "./static",
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeSlug, rehypeKatex],
  },
});
