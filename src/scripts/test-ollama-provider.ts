import { ollamaProvider } from "../providers/ollama.provider.js";

async function main() {
  console.log("Testing Ollama Provider...");

  const result = await ollamaProvider.complete({
    messages: [
      {
        role: "system",
        content: "تو دستیار فارسی Senarist هستی. کوتاه و دقیق پاسخ بده.",
      },
      {
        role: "user",
        content: "در یک جمله بگو تقویم محتوایی اینستاگرام چیست؟",
      },
    ],
  });

  console.log("\nProvider:", result.provider);
  console.log("Model:", result.model);
  console.log("Response:", result.content);
  console.log("Usage:", result.usage);
}

main().catch((error) => {
  console.error("Provider test failed:", error);
  process.exitCode = 1;
});
