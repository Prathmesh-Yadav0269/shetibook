import { Router } from 'express';
import { familyController } from './family.controller.js';
import { requireAuth, requireGroupMembership } from '../../middleware/auth.middleware.js';

export const familyRouter = Router();

// Public/authenticated invitation lookup
familyRouter.get('/invitations/:token', (req, res, next) => familyController.getInvitationInfo(req, res, next));

// Authenticated endpoints
familyRouter.use(requireAuth);

familyRouter.post('/', (req, res, next) => familyController.createGroup(req, res, next));
familyRouter.get('/', (req, res, next) => familyController.listGroups(req, res, next));
familyRouter.post('/join', (req, res, next) => familyController.acceptInvitation(req, res, next));

// Group-specific endpoints
familyRouter.get('/:groupId', requireGroupMembership(['owner', 'member']), (req, res, next) => familyController.getGroupDetails(req, res, next));
familyRouter.post('/:groupId/invitations', requireGroupMembership(['owner']), (req, res, next) => familyController.createInvitation(req, res, next));
familyRouter.delete('/:groupId/invitations/:invitationId', requireGroupMembership(['owner']), (req, res, next) => familyController.revokeInvitation(req, res, next));
familyRouter.delete('/:groupId/members/:memberUserId', requireGroupMembership(['owner']), (req, res, next) => familyController.removeMember(req, res, next));
familyRouter.delete('/:groupId', requireGroupMembership(['owner']), (req, res, next) => familyController.deleteGroup(req, res, next));
