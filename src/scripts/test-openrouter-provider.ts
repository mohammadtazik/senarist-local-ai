import "dotenv/config";

import { openRouterProvider } from "../providers/openrouter.provider.js";

async function main() {
  console.log("Testing OpenRouter JSON Mode...");

  const result = await openRouterProvider.complete({
    messages: [
      {
        role: "system",
        content: `
تو دستیار فارسی Senarist هستی.
فقط یک JSON معتبر برگردان.
هیچ Markdown یا توضیحی خارج از JSON ننویس.
ساختار:
{
  "message": "پاسخ فارسی",
  "language": "fa"
}
`,
      },
      {
        role: "user",
        content: "در یک جمله بگو تقویم محتوایی اینستاگرام چیست؟",
      },
    ],
    temperature: 0.45,
    timeoutMs: 120000,
    responseFormat: "json",
  });

  console.log("\nProvider:", result.provider);
  console.log("Model:", result.model);
  console.log("Usage:", result.usage);

  const parsed: unknown = JSON.parse(result.content);

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error("Response is not a JSON object");
  }

  console.log("\nJSON validation: PASSED");
  console.log("Response:", JSON.stringify(parsed, null, 2));
}

main().catch((error) => {
  console.error(
    "OpenRouter JSON test failed:",
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});
