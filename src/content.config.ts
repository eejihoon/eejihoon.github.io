import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    date: z.coerce.date().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    toc: z.boolean().optional(),
    readTime: z.boolean().optional(),
    autonumber: z.boolean().optional(),
    math: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    showTags: z.boolean().optional(),
    hideBackToTop: z.boolean().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  posts,
};
