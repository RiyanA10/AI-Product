import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number with thousand separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with thousand separators
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return '0';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format price with currency and thousand separators
 * @param value - Number to format
 * @param currency - Currency code (default: 'SAR')
 * @returns Formatted price string with currency
 */
export function formatPrice(value: number | null | undefined, currency: string = 'SAR'): string {
  if (value === null || value === undefined) return `${currency} 0.00`;
  
  return `${currency} ${formatNumber(value, 2)}`;
}
