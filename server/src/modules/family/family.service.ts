import crypto from 'crypto';
import { getDatabaseClient } from '../../database/client.js';
import { generateInvitationToken, hashToken } from '../../utils/crypto.js';
import { AppError } from '../../middleware/error.middleware.js';
import { logger } from '../../utils/logger.js';

export class FamilyService {
  async createGroup(name: string, ownerId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const groupId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Use transaction / sequential execution
    await client.batch([
      {
        sql: `
          INSERT INTO farming_groups (id, name, owner_id, status, created_at, updated_at)
          VALUES (?, ?, ?, 'active', ?, ?)
        `,
        args: [groupId, name.trim(), ownerId, now, now],
      },
      {
        sql: `
          INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'owner', 'active', ?)
        `,
        args: [membershipId, groupId, ownerId, now],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'GROUP_CREATED', 'farming_group', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          ownerId,
          groupId,
          JSON.stringify({ name: name.trim() }),
          ip || null,
          userAgent || null,
          now,
        ],
      },
    ]);

    logger.info('Farming group created', { groupId, ownerId });

    return {
      id: groupId,
      name: name.trim(),
      ownerId,
      role: 'owner',
      createdAt: now,
    };
  }

  async listUserGroups(userId: string) {
    const client = getDatabaseClient();
    const result = await client.execute({
      sql: `
        SELECT fg.id, fg.name, fg.owner_id, gm.role, gm.joined_at,
               (SELECT COUNT(*) FROM group_members WHERE group_id = fg.id AND status = 'active') as member_count
        FROM group_members gm
        JOIN farming_groups fg ON fg.id = gm.group_id
        WHERE gm.user_id = ? AND gm.status = 'active' AND fg.status = 'active'
        ORDER BY fg.created_at ASC
      `,
      args: [userId],
    });

    return result.rows.map(row => ({
      id: String(row.id),
      name: String(row.name),
      ownerId: String(row.owner_id),
      role: String(row.role),
      joinedAt: String(row.joined_at),
      memberCount: Number(row.member_count),
    }));
  }

  async getGroupDetails(groupId: string, userId: string) {
    const client = getDatabaseClient();

    // Verify user is an active member
    const memberCheck = await client.execute({
      sql: 'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND status = \'active\'',
      args: [groupId, userId],
    });

    if (memberCheck.rows.length === 0) {
      throw new AppError('You do not have access to this group.', 403, 'FORBIDDEN_GROUP_ACCESS');
    }

    const groupResult = await client.execute({
      sql: 'SELECT id, name, owner_id, status, created_at FROM farming_groups WHERE id = ?',
      args: [groupId],
    });

    if (groupResult.rows.length === 0 || groupResult.rows[0].status !== 'active') {
      throw new AppError('Farming group not found or inactive.', 404, 'GROUP_NOT_FOUND');
    }

    const group = groupResult.rows[0];

    // Fetch active members
    const membersResult = await client.execute({
      sql: `
        SELECT gm.id as membership_id, gm.user_id, gm.role, gm.joined_at, u.phone_number
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ? AND gm.status = 'active'
        ORDER BY gm.role DESC, gm.joined_at ASC
      `,
      args: [groupId],
    });

    // Fetch pending invitations (if owner)
    let pendingInvitations: Array<Record<string, unknown>> = [];
    if (String(memberCheck.rows[0].role) === 'owner') {
      const invResult = await client.execute({
        sql: `
          SELECT id, intended_phone, status, expires_at, created_at
          FROM group_invitations
          WHERE group_id = ? AND status = 'pending' AND expires_at > ?
          ORDER BY created_at DESC
        `,
        args: [groupId, new Date().toISOString()],
      });

      pendingInvitations = invResult.rows.map(inv => ({
        id: String(inv.id),
        intendedPhone: inv.intended_phone ? String(inv.intended_phone) : null,
        status: String(inv.status),
        expiresAt: String(inv.expires_at),
        createdAt: String(inv.created_at),
      }));
    }

    return {
      group: {
        id: String(group.id),
        name: String(group.name),
        ownerId: String(group.owner_id),
        createdAt: String(group.created_at),
      },
      currentRole: String(memberCheck.rows[0].role),
      members: membersResult.rows.map(m => ({
        membershipId: String(m.membership_id),
        userId: String(m.user_id),
        phoneNumber: String(m.phone_number),
        role: String(m.role),
        joinedAt: String(m.joined_at),
      })),
      pendingInvitations,
    };
  }

  async createInvitation(groupId: string, ownerId: string, intendedPhone?: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    // Verify owner
    const groupCheck = await client.execute({
      sql: 'SELECT id, name FROM farming_groups WHERE id = ? AND owner_id = ? AND status = \'active\'',
      args: [groupId, ownerId],
    });

    if (groupCheck.rows.length === 0) {
      throw new AppError('Only the group owner can create invitations.', 403, 'ONLY_OWNER_CAN_INVITE');
    }

    const invitationId = crypto.randomUUID();
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    // 7 days expiration
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await client.execute({
      sql: `
        INSERT INTO group_invitations (id, group_id, inviter_id, token_hash, intended_phone, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `,
      args: [invitationId, groupId, ownerId, tokenHash, intendedPhone || null, expiresAt, now.toISOString()],
    });

    // Audit log
    await client.execute({
      sql: `
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
        VALUES (?, ?, 'INVITATION_CREATED', 'group_invitation', ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        ownerId,
        invitationId,
        JSON.stringify({ groupId, intendedPhone: intendedPhone ? intendedPhone.slice(-4) : null }),
        ip || null,
        userAgent || null,
        now.toISOString(),
      ],
    });

    logger.info('Invitation created', { invitationId, groupId });

    return {
      invitationId,
      groupId,
      token: rawToken, // Given to owner to share
      expiresAt,
    };
  }

  async getInvitationInfo(rawToken: string) {
    const client = getDatabaseClient();
    const tokenHash = hashToken(rawToken);

    const result = await client.execute({
      sql: `
        SELECT gi.id, gi.group_id, gi.status, gi.expires_at, gi.intended_phone,
               fg.name as group_name, u.phone_number as owner_phone
        FROM group_invitations gi
        JOIN farming_groups fg ON fg.id = gi.group_id
        JOIN users u ON u.id = gi.inviter_id
        WHERE gi.token_hash = ?
      `,
      args: [tokenHash],
    });

    if (result.rows.length === 0) {
      throw new AppError('Invalid invitation token.', 404, 'INVITATION_NOT_FOUND');
    }

    const inv = result.rows[0];
    const isExpired = new Date(String(inv.expires_at)).getTime() <= Date.now();

    return {
      id: String(inv.id),
      groupId: String(inv.group_id),
      groupName: String(inv.group_name),
      ownerPhoneEnding: String(inv.owner_phone).slice(-4),
      intendedPhone: inv.intended_phone ? String(inv.intended_phone) : null,
      status: isExpired && inv.status === 'pending' ? 'expired' : String(inv.status),
      expiresAt: String(inv.expires_at),
      isValid: inv.status === 'pending' && !isExpired,
    };
  }

  async acceptInvitation(rawToken: string, userId: string, userPhone: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();
    const tokenHash = hashToken(rawToken);

    const result = await client.execute({
      sql: `
        SELECT gi.id, gi.group_id, gi.status, gi.expires_at, gi.intended_phone, fg.name as group_name
        FROM group_invitations gi
        JOIN farming_groups fg ON fg.id = gi.group_id
        WHERE gi.token_hash = ?
      `,
      args: [tokenHash],
    });

    if (result.rows.length === 0) {
      throw new AppError('Invalid invitation token.', 404, 'INVITATION_NOT_FOUND');
    }

    const inv = result.rows[0];

    if (inv.status === 'accepted') {
      throw new AppError('This invitation has already been used.', 400, 'INVITATION_ALREADY_USED');
    }

    if (inv.status === 'revoked') {
      throw new AppError('This invitation has been revoked by the group owner.', 400, 'INVITATION_REVOKED');
    }

    const isExpired = new Date(String(inv.expires_at)).getTime() <= Date.now();
    if (isExpired || inv.status === 'expired') {
      throw new AppError('This invitation has expired.', 400, 'INVITATION_EXPIRED');
    }

    if (inv.intended_phone && String(inv.intended_phone) !== userPhone) {
      throw new AppError('This invitation was sent to a different phone number.', 403, 'PHONE_MISMATCH');
    }

    const groupId = String(inv.group_id);

    // Check if user is already an active member of this group
    const existingActive = await client.execute({
      sql: 'SELECT id, role FROM group_members WHERE group_id = ? AND user_id = ? AND status = \'active\'',
      args: [groupId, userId],
    });

    if (existingActive.rows.length > 0) {
      throw new AppError('You are already an active member of this family group.', 409, 'ALREADY_MEMBER');
    }

    const now = new Date().toISOString();
    const membershipId = crypto.randomUUID();

    // Batch acceptance and member insert
    await client.batch([
      {
        sql: `
          UPDATE group_invitations
          SET status = 'accepted', accepted_at = ?, accepted_by = ?
          WHERE id = ?
        `,
        args: [now, userId, String(inv.id)],
      },
      {
        sql: `
          INSERT INTO group_members (id, group_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'member', 'active', ?)
        `,
        args: [membershipId, groupId, userId, now],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'INVITATION_ACCEPTED', 'group_membership', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          userId,
          membershipId,
          JSON.stringify({ groupId, invitationId: String(inv.id) }),
          ip || null,
          userAgent || null,
          now,
        ],
      },
    ]);

    logger.info('Invitation accepted and member added', { userId, groupId });

    return {
      success: true,
      groupId,
      groupName: String(inv.group_name),
    };
  }

  async removeMember(groupId: string, ownerId: string, targetUserId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    // Verify owner
    const groupCheck = await client.execute({
      sql: 'SELECT id, owner_id FROM farming_groups WHERE id = ? AND status = \'active\'',
      args: [groupId],
    });

    if (groupCheck.rows.length === 0) {
      throw new AppError('Group not found.', 404, 'GROUP_NOT_FOUND');
    }

    if (String(groupCheck.rows[0].owner_id) !== ownerId) {
      throw new AppError('Only the group owner can remove members.', 403, 'ONLY_OWNER_CAN_REMOVE');
    }

    if (ownerId === targetUserId) {
      throw new AppError('The group owner cannot be removed from the group.', 400, 'CANNOT_REMOVE_OWNER');
    }

    const memberCheck = await client.execute({
      sql: 'SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = \'active\'',
      args: [groupId, targetUserId],
    });

    if (memberCheck.rows.length === 0) {
      throw new AppError('Member not found or not active in this group.', 404, 'MEMBER_NOT_FOUND');
    }

    const now = new Date().toISOString();

    await client.batch([
      {
        sql: `
          UPDATE group_members
          SET status = 'removed', removed_at = ?, removed_by = ?
          WHERE group_id = ? AND user_id = ? AND status = 'active'
        `,
        args: [now, ownerId, groupId, targetUserId],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
          VALUES (?, ?, 'MEMBER_REMOVED', 'group_member', ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          ownerId,
          String(memberCheck.rows[0].id),
          JSON.stringify({ groupId, removedUserId: targetUserId }),
          ip || null,
          userAgent || null,
          now,
        ],
      },
    ]);

    logger.info('Member removed from group', { groupId, targetUserId, removedBy: ownerId });

    return {
      success: true,
      message: 'Member removed successfully.',
    };
  }

  async revokeInvitation(groupId: string, ownerId: string, invitationId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    const invCheck = await client.execute({
      sql: `
        SELECT gi.id, fg.owner_id
        FROM group_invitations gi
        JOIN farming_groups fg ON fg.id = gi.group_id
        WHERE gi.id = ? AND gi.group_id = ? AND gi.status = 'pending'
      `,
      args: [invitationId, groupId],
    });

    if (invCheck.rows.length === 0) {
      throw new AppError('Pending invitation not found.', 404, 'INVITATION_NOT_FOUND');
    }

    if (String(invCheck.rows[0].owner_id) !== ownerId) {
      throw new AppError('Only the group owner can revoke invitations.', 403, 'FORBIDDEN');
    }

    const now = new Date().toISOString();

    await client.batch([
      {
        sql: 'UPDATE group_invitations SET status = \'revoked\' WHERE id = ?',
        args: [invitationId],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
          VALUES (?, ?, 'INVITATION_REVOKED', 'group_invitation', ?, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), ownerId, invitationId, ip || null, userAgent || null, now],
      },
    ]);

    return { success: true };
  }

  async deleteGroup(groupId: string, ownerId: string, ip?: string, userAgent?: string) {
    const client = getDatabaseClient();

    const groupCheck = await client.execute({
      sql: 'SELECT id, owner_id FROM farming_groups WHERE id = ? AND status = \'active\'',
      args: [groupId],
    });

    if (groupCheck.rows.length === 0) {
      throw new AppError('Group not found.', 404, 'GROUP_NOT_FOUND');
    }

    if (String(groupCheck.rows[0].owner_id) !== ownerId) {
      throw new AppError('Only the group owner can deactivate the group.', 403, 'ONLY_OWNER_CAN_DELETE');
    }

    const now = new Date().toISOString();

    // Safe deactivation: Never silently destroy history
    await client.batch([
      {
        sql: 'UPDATE farming_groups SET status = \'deactivated\', updated_at = ? WHERE id = ?',
        args: [now, groupId],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
          VALUES (?, ?, 'GROUP_DEACTIVATED', 'farming_group', ?, ?, ?, ?)
        `,
        args: [crypto.randomUUID(), ownerId, groupId, ip || null, userAgent || null, now],
      },
    ]);

    logger.info('Group deactivated safely', { groupId, ownerId });

    return {
      success: true,
      message: 'Group deactivated successfully. Historical records preserved.',
    };
  }
}

export const familyService = new FamilyService();
