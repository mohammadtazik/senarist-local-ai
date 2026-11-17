
import { pool } from '../config/database.js';

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}
export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

export interface CategoryFeatureRecord {
  id: string;
  category_id: string;
  feature_key: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export interface InheritedCategoryFeature
  extends CategoryFeatureRecord {
  source_category_id: string;
  inherited: boolean;
}
export interface CategoryContentTypeRecord {
  id: string;
  category_id: string;
  content_type_key: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export interface InheritedCategoryContentType
  extends CategoryContentTypeRecord {
  source_category_id: string;
  inherited: boolean;
}

export const categoryRepository = {
  async findTree(): Promise<CategoryTreeNode[]> {
  const result = await pool.query<{
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
}>(
    `WITH RECURSIVE active_categories AS (
       SELECT
         id,
         name,
         slug,
         description,
         parent_id,
         sort_order
       FROM categories
       WHERE is_active = TRUE
         AND parent_id IS NULL

       UNION ALL

       SELECT
         c.id,
         c.name,
         c.slug,
         c.description,
         c.parent_id,
         c.sort_order
       FROM categories c
       INNER JOIN active_categories ac
         ON c.parent_id = ac.id
       WHERE c.is_active = TRUE
     )
     SELECT
       id,
       name,
       slug,
       description,
       parent_id,
       sort_order
     FROM active_categories
     ORDER BY sort_order ASC, name ASC`
  );

  const nodes = new Map<string, CategoryTreeNode>();

  for (const row of result.rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
      children: [],
    });
  }

  const tree: CategoryTreeNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentId === null) {
      tree.push(node);
      continue;
    }

    const parent = nodes.get(node.parentId);

    if (parent) {
      parent.children.push(node);
    }
  }

  return tree;
},
  async findAll(): Promise<CategoryRecord[]> {
    const result = await pool.query<CategoryRecord>(
      `SELECT id, name, slug, description, is_active,
              sort_order, created_at, updated_at
       FROM categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );

    return result.rows;
  },

  async findById(id: string): Promise<CategoryRecord | null> {
    const result = await pool.query<CategoryRecord>(
      `SELECT id, name, slug, description, is_active,
              sort_order, created_at, updated_at
       FROM categories
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [id]
    );

    return result.rows[0] ?? null;
  },

  async findBySlug(slug: string): Promise<CategoryRecord | null> {
    const result = await pool.query<CategoryRecord>(
      `SELECT id, name, slug, description, is_active,
              sort_order, created_at, updated_at
       FROM categories
       WHERE slug = $1 AND is_active = TRUE
       LIMIT 1`,
      [slug]
    );

    return result.rows[0] ?? null;
  },


async findInheritedFeatures(
  categoryId: string
): Promise<InheritedCategoryFeature[]> {
  const result = await pool.query<InheritedCategoryFeature>(
    `WITH RECURSIVE category_ancestors AS (
       SELECT
         id,
         parent_id,
         is_active,
         0 AS depth,
         ARRAY[id] AS path
       FROM categories
       WHERE id = $1

       UNION ALL

       SELECT
         parent.id,
         parent.parent_id,
         parent.is_active,
         child.depth + 1,
         child.path || parent.id
       FROM categories parent
       INNER JOIN category_ancestors child
         ON parent.id = child.parent_id
       WHERE NOT (parent.id = ANY(child.path))
     ),
     valid_category AS (
       SELECT
         COUNT(*) > 0
         AND BOOL_AND(is_active)
         AND BOOL_OR(parent_id IS NULL) AS is_valid
       FROM category_ancestors
     ),
     ranked_features AS (
       SELECT
         cf.id,
         cf.category_id,
         cf.feature_key,
         cf.name,
         cf.description,
         cf.config,
         cf.is_active,
         cf.sort_order,
         ca.id AS source_category_id,
         ca.depth,
         ROW_NUMBER() OVER (
           PARTITION BY cf.feature_key
           ORDER BY ca.depth ASC
         ) AS priority
       FROM category_ancestors ca
       CROSS JOIN valid_category vc
       INNER JOIN category_features cf
         ON cf.category_id = ca.id
       WHERE vc.is_valid
     )
     SELECT
       id,
       category_id,
       feature_key,
       name,
       description,
       config,
       is_active,
       sort_order,
       source_category_id,
       (depth > 0) AS inherited
     FROM ranked_features
     WHERE priority = 1
       AND is_active = TRUE
     ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  );

  return result.rows;
},


async isAvailableInTree(categoryId: string): Promise<boolean> {
  const result = await pool.query<{ is_valid: boolean }>(
    `WITH RECURSIVE category_ancestors AS (
       SELECT
         id,
         parent_id,
         is_active,
         ARRAY[id] AS path
       FROM categories
       WHERE id = $1

       UNION ALL

       SELECT
         parent.id,
         parent.parent_id,
         parent.is_active,
         child.path || parent.id
       FROM categories parent
       INNER JOIN category_ancestors child
         ON parent.id = child.parent_id
       WHERE NOT (parent.id = ANY(child.path))
     )
     SELECT
       COALESCE(
         COUNT(*) > 0
         AND BOOL_AND(is_active)
         AND BOOL_OR(parent_id IS NULL),
         FALSE
       ) AS is_valid
     FROM category_ancestors`,
    [categoryId]
  );

  return result.rows[0]?.is_valid ?? false;
},

  async findFeatures(categoryId: string): Promise<CategoryFeatureRecord[]> {
    const result = await pool.query<CategoryFeatureRecord>(
      `SELECT id, category_id, feature_key, name, description,
              config, is_active, sort_order
       FROM category_features
       WHERE category_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, name ASC`,
      [categoryId]
    );

    return result.rows;
  },


async findInheritedContentTypes(
  categoryId: string
): Promise<InheritedCategoryContentType[]> {
  const result = await pool.query<InheritedCategoryContentType>(
    `WITH RECURSIVE category_ancestors AS (
       SELECT
         id,
         parent_id,
         is_active,
         0 AS depth,
         ARRAY[id] AS path
       FROM categories
       WHERE id = $1

       UNION ALL

       SELECT
         parent.id,
         parent.parent_id,
         parent.is_active,
         child.depth + 1,
         child.path || parent.id
       FROM categories parent
       INNER JOIN category_ancestors child
         ON parent.id = child.parent_id
       WHERE NOT (parent.id = ANY(child.path))
     ),
     valid_category AS (
       SELECT
         COUNT(*) > 0
         AND BOOL_AND(is_active)
         AND BOOL_OR(parent_id IS NULL) AS is_valid
       FROM category_ancestors
     ),
     ranked_content_types AS (
       SELECT
         ct.id,
         ct.category_id,
         ct.content_type_key,
         ct.name,
         ct.description,
         ct.config,
         ct.is_active,
         ct.sort_order,
         ca.id AS source_category_id,
         ca.depth,
         ROW_NUMBER() OVER (
           PARTITION BY ct.content_type_key
           ORDER BY ca.depth ASC
         ) AS priority
       FROM category_ancestors ca
       CROSS JOIN valid_category vc
       INNER JOIN category_content_types ct
         ON ct.category_id = ca.id
       WHERE vc.is_valid
     )
     SELECT
       id,
       category_id,
       content_type_key,
       name,
       description,
       config,
       is_active,
       sort_order,
       source_category_id,
       (depth > 0) AS inherited
     FROM ranked_content_types
     WHERE priority = 1
       AND is_active = TRUE
     ORDER BY sort_order ASC, name ASC`,
    [categoryId]
  );

  return result.rows;
},

  async findContentTypes(
    categoryId: string
  ): Promise<CategoryContentTypeRecord[]> {
    const result = await pool.query<CategoryContentTypeRecord>(
      `SELECT id, category_id, content_type_key, name, description,
              config, is_active, sort_order
       FROM category_content_types
       WHERE category_id = $1 AND is_active = TRUE
       ORDER BY sort_order ASC, name ASC`,
      [categoryId]
    );

    return result.rows;
  },
};
