import { Module, Global } from '@nestjs/common';
import { 
  IsUuidConstraint,
  IsBusinessTierConstraint,
  IsTenantSlugConstraint,
  IsPhoneNumberConstraint,
  IsCurrencyCodeConstraint,
  IsTimezoneConstraint,
  IsMonetaryAmountConstraint,
  IsSkuConstraint,
  IsHexColorConstraint,
} from './decorators/validation.decorators';
import {
  IsUniqueConstraint,
  ExistsConstraint,
  BelongsToTenantConstraint,
  BusinessRuleConstraint,
  FileValidationConstraint,
} from './validators/async-validators';
import { ValidationService } from './services/validation.service';

/**
 * Global validation module providing custom validators and sanitizers
 */
@Global()
@Module({
  providers: [
    // Core validation service
    ValidationService,
    
    // Sync validators
    IsUuidConstraint,
    IsBusinessTierConstraint,
    IsTenantSlugConstraint,
    IsPhoneNumberConstraint,
    IsCurrencyCodeConstraint,
    IsTimezoneConstraint,
    IsMonetaryAmountConstraint,
    IsSkuConstraint,
    IsHexColorConstraint,
    
    // Async validators
    IsUniqueConstraint,
    ExistsConstraint,
    BelongsToTenantConstraint,
    BusinessRuleConstraint,
    FileValidationConstraint,
  ],
  exports: [
    // Core validation service
    ValidationService,
    
    // Sync validators
    IsUuidConstraint,
    IsBusinessTierConstraint,
    IsTenantSlugConstraint,
    IsPhoneNumberConstraint,
    IsCurrencyCodeConstraint,
    IsTimezoneConstraint,
    IsMonetaryAmountConstraint,
    IsSkuConstraint,
    IsHexColorConstraint,
    
    // Async validators
    IsUniqueConstraint,
    ExistsConstraint,
    BelongsToTenantConstraint,
    BusinessRuleConstraint,
    FileValidationConstraint,
  ],
})
export class ValidationModule {}