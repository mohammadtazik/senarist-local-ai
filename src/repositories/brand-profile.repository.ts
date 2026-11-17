
import { pool } from '../config/database.js';

export type BrandGoal = 'sales' | 'engagement' | 'followers';

export type BrandTone =
  | 'formal'
  | 'friendly'
  | 'sales'
  | 'educational'
  | 'storytelling'
  | 'professional'
  | 'luxury'
  | 'inspirational'
  | 'funny';

export interface BrandProfileRecord {
  id: string;
  user_id: string;
  primary_category_id: string;
  business_type: string;
  instagram_handle: string;
  target_audience: string;
  goal: BrandGoal;
  tone: BrandTone;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBrandProfileInput {
  userId: string;
  primaryCategoryId: string;
  businessType: string;
  instagramHandle?: string;
  targetAudience: string;
  goal: BrandGoal;
  tone: BrandTone;
}

export type UpdateBrandProfileInput = Partial<
  Omit<CreateBrandProfileInput, 'userId'>
>;

export const brandProfileRepository = {
  async findByUserId(userId: string): Promise<BrandProfileRecord | null> {
    const result = await pool.query<BrandProfileRecord>(
      `SELECT *
       FROM brand_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] ?? null;
  },

  async findById(id: string): Promise<BrandProfileRecord | null> {
    const result = await pool.query<BrandProfileRecord>(
      `SELECT *
       FROM brand_profiles
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    return result.rows[0] ?? null;
  },

  async create(input: CreateBrandProfileInput): Promise<BrandProfileRecord> {
    const result = await pool.query<BrandProfileRecord>(
      `INSERT INTO brand_profiles (
        user_id,
        primary_category_id,
        business_type,
        instagram_handle,
        target_audience,
        goal,
        tone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        input.userId,
        input.primaryCategoryId,
        input.businessType,
        input.instagramHandle ?? '',
        input.targetAudience,
        input.goal,
        input.tone,
      ]
    );

    return result.rows[0]!;
  },

  async update(
    userId: string,
    input: UpdateBrandProfileInput
  ): Promise<BrandProfileRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [userId];

    const mapping = {
      primaryCategoryId: 'primary_category_id',
      businessType: 'business_type',
      instagramHandle: 'instagram_handle',
      targetAudience: 'target_audience',
      goal: 'goal',
      tone: 'tone',
    } as const;

    for (const key of Object.keys(mapping) as Array<keyof typeof mapping>) {
      const value = input[key];

      if (value !== undefined) {
        values.push(value);
        fields.push(`${mapping[key]} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      return this.findByUserId(userId);
    }

    const result = await pool.query<BrandProfileRecord>(
      `UPDATE brand_profiles
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] ?? null;
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM brand_profiles
       WHERE user_id = $1`,
      [userId]
    );

    return (result.rowCount ?? 0) > 0;
  },
};
