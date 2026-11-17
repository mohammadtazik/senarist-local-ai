import "dotenv/config";

import { openRouterProvider } from "../providers/openrouter.provider.js";
import { storyPrompt } from "../prompts/story.prompt.js";
import { storyResponseSchema } from "../schemas/ai.schema.js";

async function main() {
  const profile = {
    businessType: "فروشگاه آنلاین لباس زنانه",
    instagramHandle: "@sample_shop",
    targetAudience: "زنان ۱۸ تا ۳۵ سال علاقه‌مند به پوشاک روزمره",
    goal: "sales" as const,
    tone: "friendly" as const,
  };

  const topic = "سه نکته برای انتخاب سایز مناسب لباس هنگام خرید آنلاین";

  const prompt = storyPrompt({
    profile,
    topic,
    storyType: "poll",
  });

  console.log("Testing OpenRouter Story Generation...");
  console.log("Requested model:", process.env.OPENROUTER_MODEL);

  const result = await openRouterProvider.complete({
    messages: [
      {
        role: "system",
        content: `
تو دستیار فارسی Senarist هستی.
فقط JSON معتبر برگردان.
هیچ Markdown یا توضیحی خارج از JSON ننویس.
تمام متن‌ها باید فارسی طبیعی و روان باشند.
`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.45,
    timeoutMs: 120000,
    responseFormat: "json",
  });

  console.log("\nProvider:", result.provider);
  console.log("Actual model:", result.model);
  console.log("Usage:", result.usage);

  const parsed: unknown = JSON.parse(result.content);
  const validation = storyResponseSchema.safeParse(parsed);

  if (!validation.success) {
    console.error("\nSchema validation: FAILED");
    console.error(validation.error.format());
    console.log("\nRaw response:", result.content);
    process.exitCode = 1;
    return;
  }

  console.log("\nSchema validation: PASSED");
  console.log(JSON.stringify(validation.data, null, 2));
}

main().catch((error) => {
  console.error(
    "Story evaluation failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
