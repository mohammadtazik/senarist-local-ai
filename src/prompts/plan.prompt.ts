import type { BrandProfile } from '../types/ai.types.js';

export function planPrompt(profile: BrandProfile): string {
  return `
تو یک استراتژیست حرفه‌ای تولید محتوای اینستاگرام برای کسب‌وکارهای ایرانی هستی.

## پروفایل برند (دقیقاً همین را رعایت کن)
- نوع کسب‌وکار: ${profile.businessType}
- مخاطب هدف: ${profile.targetAudience}
- هدف تجاری: ${profile.goal}
- هندل: ${profile.instagramHandle}

قواعد:
- نوع کسب‌وکار را عوض نکن.
- همه ایده‌ها مخصوص همین کسب‌وکار و همین مخاطب باشند.

## وظیفه
یک تقویم محتوایی دقیقاً ۳۰ روزه بساز.

## ساختار خروجی JSON

{
  "ideas": [
    {
      "title": "عنوان ایده",
      "type": "reel",
      "description": "توضیح اجرایی کوتاه",
      "dayIndex": 0
    }
  ]
}

## ترکیب اجباری نوع محتوا
باید از هر ۴ نوع استفاده کنی. هیچ نوعی را حذف نکن.

حداقل تعداد:
- reel: حداقل ۸
- story: حداقل ۶
- carousel: حداقل ۵
- post: حداقل ۴

مجموع باید دقیقاً ۳۰ باشد.
type فقط یکی از این مقادیر باشد: reel | carousel | story | post

## قوانین dayIndex
- دقیقاً ۳۰ ایده
- dayIndex از ۰ تا ۲۹
- هیچ dayIndex تکراری نباشد

## کیفیت ایده
- عنوان کوتاه و غیرتکراری
- description اجرایی باشد
- ایده‌ها حول همین کسب‌وکار بچرخند
- از آمار ساختگی استفاده نکن
- فارسی طبیعی بنویس

فقط JSON معتبر برگردان.
`;
}
