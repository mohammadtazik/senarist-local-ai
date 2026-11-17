
import { z } from 'zod';

const businessGoalSchema = z.enum([
  'sales',
  'engagement',
  'followers',
]);

const brandToneSchema = z.enum([
  'formal',
  'friendly',
  'sales',
  'educational',
  'storytelling',
  'professional',
  'luxury',
  'inspirational',
  'funny',
]);

const contentTypeSchema = z.enum([
  'reel',
  'carousel',
  'story',
  'post',
]);

const storyTypeSchema = z.enum([
  'poll',
  'qa',
  'interactive',
  'leadGen',
]);

export const brandProfileSchema = z.object({
  businessType: z.string().trim().min(1).max(200),
  instagramHandle: z.string().max(100),
  targetAudience: z.string().trim().min(1).max(500),
  goal: businessGoalSchema,
  tone: brandToneSchema,
}).strict();

const planRequestSchema = z.object({
  task: z.literal('plan'),
  data: z.object({
    profile: brandProfileSchema,
  }).strict(),
}).strict();

const reelRequestSchema = z.object({
  task: z.literal('reel'),
  data: z.object({
    profile: brandProfileSchema,
    topic: z.string().trim().min(1).max(1000),
    durationSec: z.number().int().min(10).max(180),
  }).strict(),
}).strict();

const captionsRequestSchema = z.object({
  task: z.literal('captions'),
  data: z.object({
    profile: brandProfileSchema,
    topic: z.string().trim().min(1).max(1000),
  }).strict(),
}).strict();

const storyRequestSchema = z.object({
  task: z.literal('story'),
  data: z.object({
    profile: brandProfileSchema,
    topic: z.string().trim().min(1).max(1000),
    storyType: storyTypeSchema,
  }).strict(),
}).strict();

export const aiRequestSchema = z.discriminatedUnion('task', [
  planRequestSchema,
  reelRequestSchema,
  captionsRequestSchema,
  storyRequestSchema,
]);

export const planResponseSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1),
    type: contentTypeSchema,
    description: z.string().min(1),
    dayIndex: z.number().int().min(0).max(29),
  })).length(30),
}).strict().superRefine((data, ctx) => {
  const indexes = data.ideas.map((idea) => idea.dayIndex);
  const unique = new Set(indexes);

  if (unique.size !== 30) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `dayIndex values must be unique 0-29. Got ${unique.size} unique values`,
      path: ['ideas'],
    });
  }

  const types = data.ideas.map((idea) => idea.type);
  const typeSet = new Set(types);

  if (typeSet.size < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Content types should be diverse. Got only: ${[...typeSet].join(', ')}`,
      path: ['ideas'],
    });
  }
});

export const reelResponseSchema = z.object({
  topic: z.string().min(1),
  durationSec: z.number().int().min(10).max(180),
  hook: z.string().min(1),
  scenes: z.array(z.object({
    order: z.number().int().positive(),
    visual: z.string().min(1),
    voiceover: z.string().min(1),
    durationSec: z.number().int().positive(),
  })).min(3).max(6),
  cta: z.string().min(1),
  hashtags: z.array(z.string().min(1)).min(5).max(8),
  musicMood: z.string().min(1),
}).strict().superRefine((data, ctx) => {
  const sum = data.scenes.reduce((acc, scene) => acc + scene.durationSec, 0);

  if (sum !== data.durationSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Sum of scene durations (${sum}) must equal durationSec (${data.durationSec})`,
      path: ['scenes'],
    });
  }

  const orders = data.scenes.map((s) => s.order);
  const expected = data.scenes.map((_, i) => i + 1);

  if (orders.join(',') !== expected.join(',')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Scene orders must be sequential starting from 1. Got: ${orders.join(', ')}`,
      path: ['scenes'],
    });
  }
});

export const captionsResponseSchema = z.object({
  topic: z.string(),
  captions: z.array(z.object({
    tone: brandToneSchema,
    text: z.string(),
    cta: z.string(),
    hashtags: z.array(z.string()),
  })).length(9),
}).strict();

export const storyResponseSchema = z.object({
  type: storyTypeSchema,
  title: z.string().min(1),
  slides: z.array(z.object({
    content: z.string().min(1),
    interaction: z.string().min(1),
    options: z.array(z.string()),
  })).min(3).max(5),
  cta: z.string().min(1),
}).strict().superRefine((data, ctx) => {
  const expectedInteraction: Record<string, string> = {
    poll: 'poll',
    qa: 'question',
    interactive: 'quiz',
    leadGen: 'dm_keyword',
  };

  const expected = expectedInteraction[data.type];
  const hasExpected = data.slides.some((s) => s.interaction === expected);

  if (!hasExpected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `At least one slide must use interaction "${expected}" for type "${data.type}"`,
      path: ['slides'],
    });
  }

  if (data.type === 'poll' || data.type === 'interactive') {
    const interactiveSlides = data.slides.filter(
      (s) => s.interaction === expected,
    );

    for (const slide of interactiveSlides) {
      if (slide.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Interaction "${expected}" requires at least 2 options`,
          path: ['slides'],
        });
        break;
      }
    }
  }

  if (data.type === 'leadGen') {
    const leadSlides = data.slides.filter((s) => s.interaction === 'dm_keyword');
    const hasKeyword = leadSlides.some((s) => s.options.length >= 1);

    if (!hasKeyword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'leadGen requires at least one dm_keyword option',
        path: ['slides'],
      });
    }
  }
});

export type AiRequest = z.infer<typeof aiRequestSchema>;
