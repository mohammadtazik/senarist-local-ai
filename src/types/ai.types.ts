export type BusinessGoal =
  | 'sales'
  | 'engagement'
  | 'followers';

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

export type ContentType =
  | 'reel'
  | 'carousel'
  | 'story'
  | 'post';

export type StoryType =
  | 'poll'
  | 'qa'
  | 'interactive'
  | 'leadGen';

export interface BrandProfile {
  businessType: string;
  instagramHandle: string;
  targetAudience: string;
  goal: BusinessGoal;
  tone: BrandTone;
}
