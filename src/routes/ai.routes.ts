import { Router } from 'express';
import { z } from 'zod';

import { aiJsonService } from '../services/ai-json.service.js';
import { aiOrchestrator } from '../services/ai-orchestrator.service.js';

const router = Router();

const testSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
});

router.post('/test', async (req, res) => {
  const validation = testSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      details: validation.error.issues,
    });
  }

  try {
    const result = await aiJsonService.generateJson({
      systemPrompt: `
You are a helpful Persian AI assistant.

Always return valid JSON.
Do not include Markdown.
Respond in Persian.
`,
      userPrompt: `
Answer the following request.

Your response must have this JSON structure:
{
  "message": "your Persian answer",
  "language": "fa"
}

Request:
${validation.data.prompt}
`,
    });

    return res.json({
      success: true,
      ...aiOrchestrator.getInfo(),
      data: result,
    });
  } catch (error) {
    console.error('AI generation error:', error);

    return res.status(502).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'AI generation failed',
    });
  }
});

export default router;
