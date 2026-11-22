import { z } from 'zod';
import { phoneNumberSchema } from './auth.validator.js';

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name must be at least 2 characters').max(60, 'Group name too long'),
});

export const createInvitationSchema = z.object({
  groupId: z.string().uuid('Invalid group ID format'),
  intendedPhone: phoneNumberSchema.optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, 'Invalid invitation token'),
});

export const removeMemberSchema = z.object({
  groupId: z.string().uuid('Invalid group ID format'),
  memberUserId: z.string().uuid('Invalid user ID format'),
});
