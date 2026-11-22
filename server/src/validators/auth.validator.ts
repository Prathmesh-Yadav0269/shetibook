import { z } from 'zod';
import { normalizePhoneNumber } from '../utils/crypto.js';

// Phone number: Must be valid 10-digit Indian mobile number
export const phoneNumberSchema = z
  .string()
  .transform(val => normalizePhoneNumber(val))
  .refine(val => /^[6-9]\d{9}$/.test(val), {
    message: 'Valid 10-digit Indian phone number required (e.g. 9876543210)',
  });

// Password: At least 8 chars, at least one letter, at least one number
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password is too long')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: z.string().min(1, 'Password is required'),
});

export const recoverPasswordSchema = z.object({
  phoneNumber: phoneNumberSchema,
  recoveryCode: z.string().min(4, 'Recovery code is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
