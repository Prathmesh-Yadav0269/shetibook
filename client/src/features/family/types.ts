export interface GroupMember {
  membershipId: string;
  userId: string;
  phoneNumber: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface PendingInvitation {
  id: string;
  intendedPhone: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface FarmingGroupDetails {
  group: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
  };
  currentRole: 'owner' | 'member';
  members: GroupMember[];
  pendingInvitations: PendingInvitation[];
}

export interface CreateInvitationResponse {
  invitationId: string;
  groupId: string;
  token: string;
  expiresAt: string;
}

export interface InvitationInfoResponse {
  id: string;
  groupId: string;
  groupName: string;
  ownerPhoneEnding: string;
  intendedPhone: string | null;
  status: string;
  expiresAt: string;
  isValid: boolean;
}
