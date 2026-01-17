import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

@InputType({ description: 'Input for opening a POS session' })
export class OpenPOSSessionInput {
  @Field(() => ID)
  @IsString()
  locationId!: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCash!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

@InputType({ description: 'Input for closing a POS session' })
export class ClosePOSSessionInput {
  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCash!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
