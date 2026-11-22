import { Request, Response, NextFunction } from 'express';
import { familyService } from './family.service.js';
import {
  createGroupSchema,
  createInvitationSchema,
  acceptInvitationSchema,
  removeMemberSchema,
} from '../../validators/group.validator.js';

export class FamilyController {
  async createGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createGroupSchema.parse(req.body);
      const result = await familyService.createGroup(
        validated.name,
        req.user!.id,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await familyService.listUserGroups(req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGroupDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groupId = String(req.params.groupId);
      const result = await familyService.getGroupDetails(groupId, req.user!.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createInvitationSchema.parse({
        groupId: req.params.groupId ? String(req.params.groupId) : req.body.groupId,
        intendedPhone: req.body.intendedPhone,
      });

      const result = await familyService.createInvitation(
        validated.groupId,
        req.user!.id,
        validated.intendedPhone,
        req.ip,
        req.headers['user-agent']
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvitationInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = String(req.params.token);
      const result = await familyService.getInvitationInfo(token);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = acceptInvitationSchema.parse(req.body);
      const result = await familyService.acceptInvitation(
        validated.token,
        req.user!.id,
        req.user!.phone_number,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = removeMemberSchema.parse({
        groupId: String(req.params.groupId),
        memberUserId: String(req.params.memberUserId),
      });

      const result = await familyService.removeMember(
        validated.groupId,
        req.user!.id,
        validated.memberUserId,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groupId = String(req.params.groupId);
      const invitationId = String(req.params.invitationId);
      const result = await familyService.revokeInvitation(
        groupId,
        req.user!.id,
        invitationId,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const groupId = String(req.params.groupId);
      const result = await familyService.deleteGroup(
        groupId,
        req.user!.id,
        req.ip,
        req.headers['user-agent']
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const familyController = new FamilyController();
