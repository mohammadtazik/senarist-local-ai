import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.middleware.js';
import { brandProfileRepository } from '../repositories/brand-profile.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';

const router = Router();

const brandProfileSchema = z.object({
  categoryId: z.string().uuid(),
  businessType: z.string().trim().min(1).max(200),
  instagramHandle: z.string().trim().max(100),
  targetAudience: z.string().trim().min(1).max(500),
  goal: z.enum(['sales', 'engagement', 'followers']),
  tone: z.enum([
    'formal',
    'friendly',
    'sales',
    'educational',
    'storytelling',
    'professional',
    'luxury',
    'inspirational',
    'funny',
  ]),
}).strict();

function formatProfile(profile: NonNullable<
  Awaited<ReturnType<typeof brandProfileRepository.findByUserId>>
>) {
  return {
    id: profile.id,
    businessType: profile.business_type,
    instagramHandle: profile.instagram_handle,
    targetAudience: profile.target_audience,
    goal: profile.goal,
    tone: profile.tone,
    categoryId: profile.primary_category_id,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

router.get('/', requireAuth, async (_req, res) => {
  try {
    const userId = res.locals.authUser.id;
    const profile = await brandProfileRepository.findByUserId(userId);

    return res.status(200).json({
      success: true,
      data: profile ? formatProfile(profile) : null,
    });
  } catch (error) {
    console.error('Get brand profile error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve brand profile',
    });
  }
});


router.post('/', requireAuth, async (req, res) => {
  const validation = brandProfileSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid brand profile data',
      details: validation.error.issues,
    });
  }

  try {
    const userId = res.locals.authUser.id;
    const data = validation.data;

    const category = await categoryRepository.findById(data.categoryId);

    if (!category) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive category',
      });
    }

    const categoryAvailable =
      await categoryRepository.isAvailableInTree(category.id);

    if (!categoryAvailable) {
      return res.status(400).json({
        success: false,
        error: 'Category or one of its parent categories is inactive',
      });
    }

    const existing = await brandProfileRepository.findByUserId(userId);

    const profile = existing
      ? await brandProfileRepository.update(userId, {
          primaryCategoryId: category.id,
          businessType: data.businessType,
          instagramHandle: data.instagramHandle,
          targetAudience: data.targetAudience,
          goal: data.goal,
          tone: data.tone,
        })
      : await brandProfileRepository.create({
          userId,
          primaryCategoryId: category.id,
          businessType: data.businessType,
          instagramHandle: data.instagramHandle,
          targetAudience: data.targetAudience,
          goal: data.goal,
          tone: data.tone,
        });

    if (!profile) {
      throw new Error('BRAND_PROFILE_SAVE_FAILED');
    }

    return res.status(existing ? 200 : 201).json({
      success: true,
      data: formatProfile(profile),
    });
  } catch (error) {
    console.error('Save brand profile error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to save brand profile',
    });
  }
});
export default router;