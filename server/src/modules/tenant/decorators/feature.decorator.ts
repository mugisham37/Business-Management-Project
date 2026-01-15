import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to require specific tenant features for a route
 * @param features Array of feature strings required
 */
export const RequireFeatures = (...features: string[]) => 
  SetMetadata('features', features);

/**
 * Decorator to require a single tenant feature for a route
 * @param feature Feature string required
 */
export const RequireFeature = (feature: string) => 
  SetMetadata('feature', feature);