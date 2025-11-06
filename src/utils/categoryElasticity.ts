// Category to elasticity mapping - Industry standard values
export const CATEGORY_ELASTICITY: Record<string, number> = {
  "Electronics & Technology": -1.5,
  "Fashion & Apparel": -1.2,
  "Luxury Goods": -0.4,
  "Food & Beverages": -0.8,
  "Health & Beauty": -0.6,
  "Home & Furniture": -1.3,
  "Sports & Outdoors": -1.4,
  "Toys & Games": -1.6,
  "Books & Media": -1.7,
  "Automotive Parts": -0.9,
  "Pharmaceuticals": -0.3,
  "Groceries (Staples)": -0.5,
  "Office Supplies": -1.1,
  "Pet Supplies": -0.7
};

export const ALLOWED_CATEGORIES = Object.keys(CATEGORY_ELASTICITY);

export const ALLOWED_CURRENCIES = ['SAR', 'USD'] as const;
export type Currency = typeof ALLOWED_CURRENCIES[number];
