import "dotenv/config";

import { openRouterProvider } from "../providers/openrouter.provider.js";
import { reelPrompt } from "../prompts/reel.prompt.js";
import { reelResponseSchema } from "../schemas/ai.schema.js";

async function main() {
  const profile = {
    businessType: "فروشگاه آنلاین لباس زنانه",
    instagramHandle: "@sample_shop",
    targetAudience: "زنان ۱۸ تا ۳۵ سال علاقه‌مند به پوشاک روزمره",
    goal: "sales" as const,
    tone: "friendly" as const,
  };

  const topic = "سه اشتباه رایج هنگام خرید اینترنتی مانتو";
  const durationSec = 30;

  const prompt = reelPrompt({
    profile,
    topic,
    durationSec,
  });

  console.log("Testing OpenRouter Reel Generation...");
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
  const validation = reelResponseSchema.safeParse(parsed);

  if (!validation.success) {
    console.error("\nSchema validation: FAILED");
    console.error(validation.error.format());
    console.log("\nRaw response:", result.content);
    process.exitCode = 1;
    return;
  }

  console.log("\nSchema validation: PASSED");
  console.log(
    "Total scene duration:",
    validation.data.scenes.reduce(
      (sum, scene) => sum + scene.durationSec,
      0,
    ),
  );
  console.log("\nGenerated reel:");
  console.log(JSON.stringify(validation.data, null, 2));
}

main().catch((error) => {
  console.error(
    "Reel evaluation failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
