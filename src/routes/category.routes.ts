
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { categoryRepository } from '../repositories/category.repository.js';

const router = Router();

// دریافت درخت دسته‌بندی‌ها
router.get('/tree', requireAuth, async (_req, res) => {
  try {
    const categories = await categoryRepository.findTree();

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get category tree error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category tree',
    });
  }
});

// دریافت Featureهای دسته‌بندی با پشتیبانی از ارث‌بری
router.get('/:categoryId/features', requireAuth, async (req, res) => {
  try {
const categoryId = Array.isArray(req.params.categoryId)
  ? req.params.categoryId[0]
  : req.params.categoryId;

if (!categoryId) {
  return res.status(400).json({
    success: false,
    error: 'Category ID is required',
  });
}
    const isAvailable =
      await categoryRepository.isAvailableInTree(categoryId);

    if (!isAvailable) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or inactive',
      });
    }

    const features =
      await categoryRepository.findInheritedFeatures(categoryId);

    const data = features.map((feature) => ({
      id: feature.id,
      featureKey: feature.feature_key,
      name: feature.name,
      description: feature.description,
      config: feature.config,
      sortOrder: feature.sort_order,
      sourceCategoryId: feature.source_category_id,
      inherited: feature.inherited,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get inherited category features error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category features',
    });
  }
});


// دریافت Content Typeهای دسته‌بندی با پشتیبانی از ارث‌بری
router.get('/:categoryId/content-types', requireAuth, async (req, res) => {
  try {
    const categoryId = Array.isArray(req.params.categoryId)
      ? req.params.categoryId[0]
      : req.params.categoryId;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'Category ID is required',
      });
    }

    const isAvailable =
      await categoryRepository.isAvailableInTree(categoryId);

    if (!isAvailable) {
      return res.status(404).json({
        success: false,
        error: 'Category not found or inactive',
      });
    }

    const contentTypes =
      await categoryRepository.findInheritedContentTypes(categoryId);

    const data = contentTypes.map((contentType) => ({
      id: contentType.id,
      contentTypeKey: contentType.content_type_key,
      name: contentType.name,
      description: contentType.description,
      config: contentType.config,
      sortOrder: contentType.sort_order,
      sourceCategoryId: contentType.source_category_id,
      inherited: contentType.inherited,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get inherited category content types error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve category content types',
    });
  }
});

export default router;
