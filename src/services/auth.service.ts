
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';

import { userRepository } from '../repositories/user.repository.js';
import type { UserRecord } from '../repositories/user.repository.js';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET is missing or too short');
}

const secretKey = new TextEncoder().encode(jwtSecret);

const TOKEN_EXPIRATION = '1h';

export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    is_active: user.is_active,
  };
}

export const authService = {
  async register(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await userRepository.findByEmail(
      normalizedEmail
    );

    if (existingUser) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await userRepository.create({
      email: normalizedEmail,
      passwordHash,
    });

    const token = await this.createToken(user);

    return {
      user: toAuthUser(user),
      token,
    };
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(
      email.trim().toLowerCase()
    );

    if (!user || !user.password_hash || !user.is_active) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const passwordIsValid = await argon2.verify(
      user.password_hash,
      password
    );

    if (!passwordIsValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const token = await this.createToken(user);

    return {
      user: toAuthUser(user),
      token,
    };
  },

  async createToken(user: UserRecord): Promise<string> {
    return new SignJWT({
      email: user.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRATION)
      .sign(secretKey);
  },

  async verifyToken(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    if (!payload.sub || typeof payload.email !== 'string') {
      throw new Error('INVALID_TOKEN');
    }

    const user = await userRepository.findById(payload.sub);

    if (!user || !user.is_active) {
      throw new Error('INVALID_TOKEN');
    }

    return toAuthUser(user);
  },
};
