/**
 * Utility for merging class names with clsx and tailwind-merge
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx
 * Note: For full tailwind-merge support, install tailwind-merge package
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}