import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../services/auth.service';
import { LoginResponse } from '../interfaces/auth.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    email: string,
    password: string,
  ): Promise<LoginResponse> {
    try {
      const loginDto = {
        email,
        password,
        rememberMe: req.body.rememberMe || false,
      };

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const loginResponse = await this.authService.login(loginDto, ipAddress, userAgent);
      return loginResponse;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}