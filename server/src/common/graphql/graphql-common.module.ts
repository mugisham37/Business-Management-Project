import { Module, Global } from '@nestjs/common';
import { DataLoaderService } from './dataloader.service';
import { DateTimeScalar, JSONScalar, UUIDScalar, DecimalScalar } from './scalars';

/**
 * Global GraphQL common module providing shared GraphQL functionality
 */
@Global()
@Module({
  providers: [
    DataLoaderService,
    DateTimeScalar,
    JSONScalar,
    UUIDScalar,
    DecimalScalar,
  ],
  exports: [
    DataLoaderService,
    DateTimeScalar,
    JSONScalar,
    UUIDScalar,
    DecimalScalar,
  ],
})
export class GraphQLCommonModule {}