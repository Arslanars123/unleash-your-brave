export interface TeamMember {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'suspended' | 'deactivated';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  name: string;
  email: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  email?: string;
  status?: 'active' | 'suspended' | 'deactivated';
}

export interface ListTeamMembersQuery {
  page: number;
  perPage: number;
  search?: string;
}
