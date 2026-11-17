import type {
  BrandProfile,
  StoryType,
} from '../types/ai.types.js';

interface StoryPromptInput {
  profile: BrandProfile;
  topic: string;
  storyType: StoryType;
}

const interactionByType: Record<StoryType, string> = {
  poll: 'poll',
  qa: 'question',
  interactive: 'quiz',
  leadGen: 'dm_keyword',
};

const typeGuide: Record<StoryType, string> = {
  poll: `
نوع: نظرسنجی (poll)
- interaction در اسلایدهای رأی‌گیری باید "poll" باشد.
- هر اسلاید poll باید دقیقاً ۲ تا ۴ گزینه واقعی و متفاوت داشته باشد.
- سؤالات اسلایدها نباید تکراری باشند.
- هر سؤال باید یک زاویه جدید از موضوع را بپرسد.
`,
  qa: `
نوع: پرسش و پاسخ (qa)
- حداقل یک اسلاید با interaction برابر "question" داشته باش.
- مخاطب را به پرسیدن سؤال در مورد موضوع دعوت کن.
- options می‌تواند خالی باشد یا ۲ نمونه سؤال پیشنهادی داشته باشد.
`,
  interactive: `
نوع: تعاملی / کوییز (interactive)
- حداقل یک اسلاید با interaction برابر "quiz" داشته باش.
- برای quiz حداقل ۲ گزینه مشخص بساز.
- سؤال کوییز باید مرتبط با موضوع و قابل پاسخ باشد.
`,
  leadGen: `
نوع: جذب لید (leadGen)
- حداقل یک اسلاید با interaction برابر "dm_keyword" داشته باش.
- یک کلمه کلیدی کوتاه برای ارسال در دایرکت بساز و داخل options بگذار.
- بگو اگر این کلمه را دایرکت کنند چه چیزی می‌گیرند.
`,
};

export function storyPrompt({
  profile,
  topic,
  storyType,
}: StoryPromptInput): string {
  const interaction = interactionByType[storyType];

  return `
تو یک استراتژیست حرفه‌ای استوری اینستاگرام برای بازار ایران هستی.

## موضوع اجباری
${topic}

## پروفایل برند (دقیقاً همین را رعایت کن)
- نوع کسب‌وکار: ${profile.businessType}
- مخاطب هدف: ${profile.targetAudience}
- هدف تجاری: ${profile.goal}
- هندل: ${profile.instagramHandle}

## نوع استوری
${storyType}
${typeGuide[storyType]}

interaction اصلی: "${interaction}"

## ساختار خروجی JSON

{
  "type": "${storyType}",
  "title": "عنوان کوتاه",
  "slides": [
    {
      "content": "متن کوتاه استوری",
      "interaction": "${interaction}",
      "options": ["گزینه ۱", "گزینه ۲"]
    }
  ],
  "cta": "دعوت به اقدام نهایی"
}

## قوانین سخت

1. بین ۳ تا ۵ اسلاید بساز.
2. اسلایدها باید یک مسیر منسجم داشته باشند:
   - اسلاید ۱: جلب توجه / طرح موضوع
   - اسلایدهای میانی: جزئیات یا تعامل
   - اسلاید آخر: جمع‌بندی + دعوت به اقدام
3. متن‌ها کوتاه و مناسب استوری باشند (۱ تا ۳ جمله).
4. اسلایدها را تکراری ننویس. هر اسلاید زاویه جدید داشته باشد.
5. مقدار type باید دقیقاً "${storyType}" باشد.
6. برای poll و quiz حتماً options پر باشد (حداقل ۲ مورد).
7. فارسی طبیعی و غیرترجمه‌ای بنویس.
8. فقط درباره موضوع بالا و همین کسب‌وکار بنویس.
9. CTA نهایی مشخص باشد.

فقط JSON معتبر برگردان.
`;
}
