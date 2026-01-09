import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service';
import { BusinessMetricsService } from '../services/business-metrics.service';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateBusinessMetricsDto,
  TenantQueryDto,
} from '../dto/tenant.dto';
import { Tenant, BusinessTier } from '../entities/tenant.entity';
import { AuthenticatedUser } from '../guards/tenant.guard';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('api/v1/tenants')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
expor