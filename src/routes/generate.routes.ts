
import { Router } from 'express';
import { z } from 'zod';

import { aiJsonService } from '../services/ai-json.service.js';
import { aiOrchestrator } from '../services/ai-orchestrator.service.js';

import { planPrompt } from '../prompts/plan.prompt.js';
import { reelPrompt } from '../prompts/reel.prompt.js';
import {
  captionPrompt,
  type CaptionTone,
} from '../prompts/caption.prompt.js';
import { storyPrompt } from '../prompts/story.prompt.js';

import type { BrandProfile } from '../types/ai.types.js';

import {
  aiRequestSchema,
  planResponseSchema,
  reelResponseSchema,
  captionsResponseSchema,
  storyResponseSchema,
} from '../schemas/ai.schema.js';

const router = Router();

const systemPrompt = `
You are Senarist, a professional Persian Instagram content strategist.

Your job is to generate high-quality, practical and creative Instagram content.

Rules:
- Respond in Persian.
- Return valid JSON only.
- Do not include Markdown.
- Do not add explanations outside JSON.
- Follow the requested JSON structure exactly.
- Do not invent information about the user's business.
`;

async function generateAndValidate<T>(
  prompt: string,
  schema: z.ZodType<T>,
  maxAttempts = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userPrompt =
      attempt === 1
        ? prompt
        : `${prompt}

## اصلاح اجباری
پاسخ قبلی نامعتبر بود.
دلیل:
${lastError instanceof Error ? lastError.message : String(lastError)}

این بار خروجی را دقیقاً مطابق ساختار JSON و قوانین بساز.
فقط JSON معتبر برگردان.
`;

    try {
      const result = await aiJsonService.generateJson({
        systemPrompt,
        userPrompt,
      });

      const validation = schema.safeParse(result);

      if (!validation.success) {
        throw new Error(
          `Invalid AI response: ${JSON.stringify(validation.error.issues)}`,
        );
      }

      if (attempt > 1) {
        console.log(`AI response repaired on attempt ${attempt}`);
      }

      return validation.data;
    } catch (error) {
      lastError = error;
      console.warn(
        `generateAndValidate failed (attempt ${attempt}/${maxAttempts}):`,
        error instanceof Error ? error.message : error,
      );

      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Content generation failed');
}

// شمارش کلمات فارسی با در نظر گرفتن نیم‌فاصله
function countWords(text: string): number {
  const normalized = text.replace(/\u200c/g, ' ');

  return normalized.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

const MIN_CAPTION_WORDS = 70;
const MAX_CAPTION_WORDS = 140;
const MAX_CAPTION_ATTEMPTS = 3;

// استخراج کلمات کلیدی مهم از موضوع برای بررسی مرتبط بودن
// function extractTopicKeywords(topic: string, businessType: string): string[] {
//   const stopWords = new Set([
//     'و', 'در', 'به', 'از', 'که', 'این', 'آن', 'با', 'برای', 'یک', 'را',
//     'تا', 'بر', 'یا', 'هم', 'می', 'های', 'ها', 'است', 'شود', 'کرد',
//     'چطور', 'چگونه', 'چرا', 'چه', 'اگر', 'ولی', 'اما', 'نیز', 'خود',
//     'هایی', 'میتواند', 'می‌تواند', 'میتونه', 'باید', 'شود', 'کرده',
//   ]);

//   const combined = `${topic} ${businessType}`;
//   const tokens =
//     combined
//       .replace(/[^\p{L}\p{N}\s]/gu, ' ')
//       .split(/\s+/)
//       .map((t) => t.trim())
//       .filter((t) => t.length >= 3 && !stopWords.has(t)) ?? [];

//   // کلمات یکتا و اولویت‌دار
//   return [...new Set(tokens)].slice(0, 12);
// }

function extractTopicKeywords(topic: string): string[] {
  const stopWords = new Set([
    'و', 'در', 'به', 'از', 'که', 'این', 'آن', 'با', 'برای',
    'یک', 'را', 'تا', 'بر', 'یا', 'هم', 'می', 'های', 'ها',
    'است', 'شود', 'کرد', 'چطور', 'چگونه', 'چرا', 'چه',
    'اگر', 'ولی', 'اما', 'نیز', 'خود', 'هایی', 'باید',
    'کرده', 'میتواند', 'می‌تواند', 'میتونه',
  ]);

  const tokens = topic
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !stopWords.has(word));

  return [...new Set(tokens)];
}

// function isCaptionOnTopic(
//   text: string,
//   keywords: string[],
// ): { ok: boolean; matched: string[] } {
//   const normalizedText = text.replace(/\u200c/g, ' ').toLowerCase();
//   const matched = keywords.filter((kw) =>
//     normalizedText.includes(kw.toLowerCase()),
//   );

//   // حداقل ۲ کلمه کلیدی از موضوع باید در متن دیده شود
//   return {
//     ok: matched.length >= 2,
//     matched,
//   };
// }

// Schema خروجی یک کپشن

function isCaptionOnTopic(text: string, keywords: string[]) {
  const normalizedText = text
    .replace(/\u200c/g, ' ')
    .toLowerCase();

  const matched = keywords.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase()),
  );

  const requiredMatches = Math.min(3, keywords.length);

  return {
    ok: keywords.length > 0 && matched.length >= requiredMatches,
    matched,
    requiredMatches,
  };
}

function singleCaptionResponseSchema(tone: CaptionTone) {
  return z.object({
    tone: z.literal(tone),

    text: z.string().min(1).superRefine((text, ctx) => {
      const wordCount = countWords(text);

      if (wordCount < MIN_CAPTION_WORDS || wordCount > MAX_CAPTION_WORDS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Caption must contain ${MIN_CAPTION_WORDS} to ${MAX_CAPTION_WORDS} words. Current word count: ${wordCount}`,
        });
      }
    }),

    cta: z.string().min(1),

    hashtags: z.array(z.string()).min(3).max(5),
  }).strict();
}

function buildRetryPrompt(
  originalPrompt: string,
  errorMessage: string,
  attempt: number,
): string {
  const isShort =
    errorMessage.includes('Current word count') &&
    /Current word count: ([1-6]?\d)\b/.test(errorMessage);
  const isLong =
    errorMessage.includes('Current word count') &&
    /Current word count: (1[5-9]\d|[2-9]\d{2,})/.test(errorMessage);
  const isOffTopic = errorMessage.includes('off-topic');

  return `
${originalPrompt}

## دستور اصلاح اجباری (تلاش ${attempt} از ${MAX_CAPTION_ATTEMPTS})

پاسخ قبلی رد شده است.

دلیل:
${errorMessage}

کپشن را از صفر دوباره بنویس.

الزامات:
- موضوع ورودی را عوض نکن. فقط درباره همان موضوع بنویس.
- حداقل دو بار به کلمات کلیدی موضوع اشاره کن.
${isOffTopic ? '- متن قبلی کاملاً نامرتبط بود. این بار فقط درباره موضوع اصلی بنویس.' : ''}
- متن بین ${MIN_CAPTION_WORDS} تا ${MAX_CAPTION_WORDS} کلمه باشد (هدف ۹۰ تا ۱۲۰).
${isShort ? '- متن قبلی کوتاه بود؛ جزئیات بیشتری درباره همان موضوع اضافه کن.' : ''}
${isLong ? '- متن قبلی طولانی بود؛ فشرده‌تر بنویس بدون حذف هسته موضوع.' : ''}
- لحن را رعایت کن.
- فقط JSON معتبر برگردان.
`;
}

// تولید کپشن با چند بار تلاش مجدد + بررسی مرتبط بودن با موضوع
async function generateCaptionWithQuality(
  profile: BrandProfile,
  topic: string,
  tone: CaptionTone,
) {
  const schema = singleCaptionResponseSchema(tone);
  const originalPrompt = captionPrompt(profile, topic, tone);
  //const keywords = extractTopicKeywords(topic, profile.businessType);
  const keywords = extractTopicKeywords(topic);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CAPTION_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? originalPrompt
        : buildRetryPrompt(
            originalPrompt,
            lastError instanceof Error ? lastError.message : String(lastError),
            attempt,
          );

    try {
      const caption = await generateAndValidate(prompt, schema);

      const relevance = isCaptionOnTopic(caption.text, keywords);

      if (!relevance.ok) {
        throw new Error(
          `Caption is off-topic. Expected keywords related to topic (matched only: ${
            relevance.matched.join(', ') || 'none'
          }). Topic keywords: ${keywords.slice(0, 6).join(', ')}`,
        );
      }

      if (attempt > 1) {
        console.log(
          `Caption repaired successfully on attempt ${attempt}: ${tone}`,
        );
      }

      return caption;
    } catch (error) {
      lastError = error;

      console.warn(
        `Caption quality check failed for ${tone} (attempt ${attempt}/${MAX_CAPTION_ATTEMPTS}):`,
        error instanceof Error ? error.message : error,
      );

      if (attempt === MAX_CAPTION_ATTEMPTS) {
        throw new Error(
          `Caption generation failed for "${tone}" after ${MAX_CAPTION_ATTEMPTS} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }
  }

  throw new Error(`Caption generation failed for "${tone}"`);
}

// تولید ۹ کپشن با ۹ درخواست مستقل و ترتیبی
async function generateCaptions(
  profile: BrandProfile,
  topic: string,
) {
  const tones: CaptionTone[] = [
    'formal',
    'friendly',
    'sales',
    'educational',
    'storytelling',
    'professional',
    'luxury',
    'inspirational',
    'funny',
  ];

  const captions: Array<{
    tone: CaptionTone;
    text: string;
    cta: string;
    hashtags: string[];
  }> = [];

  for (const tone of tones) {
    console.log(`Generating caption: ${tone}`);

    const caption = await generateCaptionWithQuality(
      profile,
      topic,
      tone,
    );

    captions.push(caption);

    console.log(
      `Caption generated successfully: ${tone} | ${countWords(caption.text)} words`,
    );
  }

  return captionsResponseSchema.parse({
    topic,
    captions,
  });
}

router.post('/generate', async (req, res) => {
  const validation = aiRequestSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      details: validation.error.issues,
    });
  }

  try {
    const request = validation.data;
    let data: unknown;

    switch (request.task) {
      case 'plan':
        data = await generateAndValidate(
          planPrompt(request.data.profile),
          planResponseSchema,
        );
        break;

      case 'reel':
        data = await generateAndValidate(
          reelPrompt({
            profile: request.data.profile,
            topic: request.data.topic,
            durationSec: request.data.durationSec,
          }),
          reelResponseSchema,
        );
        break;

      case 'captions':
        data = await generateCaptions(
          request.data.profile,
          request.data.topic,
        );
        break;

      case 'story':
        data = await generateAndValidate(
          storyPrompt({
            profile: request.data.profile,
            topic: request.data.topic,
            storyType: request.data.storyType,
          }),
          storyResponseSchema,
        );
        break;
    }

    return res.status(200).json({
      success: true,
      task: request.task,
      ...aiOrchestrator.getInfo(),
      data,
    });
  } catch (error) {
    console.error('Content generation error:', error);

    return res.status(502).json({
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Content generation failed',
    });
  }
});

export default router;
