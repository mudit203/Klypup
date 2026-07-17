'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  UserCheck, 
  Shield, 
  Mail,
  Lock,
  UserPlus,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ANALYST';
  created_at: string;
}

export default function UserManagementPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite user modal/form state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'ANALYST'>('ANALYST');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch team members.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setIsSubmittingInvite(true);
    try {
      await api.post('/admin/users/invite', {
        name: inviteName,
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
      });
      toast.success(`Successfully invited and registered "${inviteName}".`);
      setIsInviteOpen(false);
      // Reset form
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('ANALYST');
      fetchUsers();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || err.response?.data?.details?.[0] || 'Failed to register team member.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, targetName: string, newRole: 'ADMIN' | 'ANALYST') => {
    if (!confirm(`Are you sure you want to change "${targetName}" permission level to ${newRole}?`)) {
      fetchUsers(); // reset select state on cancel
      return;
    }
    try {
      await api.patch(`/admin/users/${targetUserId}/role`, { role: newRole });
      toast.success(`Updated "${targetName}" permission level to ${newRole}.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update user role.');
      fetchUsers();
    }
  };

  const handleRemoveUser = async (targetUserId: string, targetName: string) => {
    if (!confirm(`Are you sure you want to remove "${targetName}" from the organization? This action is permanent.`)) return;
    try {
      await api.delete(`/admin/users/${targetUserId}`);
      toast.success(`Successfully removed "${targetName}" from the organization.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  return (
    <div className="font-sans min-h-screen bg-neutral-50 p-6 md:p-8">
      
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.push('/')}
              className="p-2 bg-white rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">User Management</h1>
              <p className="text-xs font-medium text-neutral-400 mt-0.5">Control employee roles and active account permissions</p>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex bg-neutral-200/60 p-1 rounded-xl border border-neutral-200/30 self-start md:self-auto select-none">
            <button 
              onClick={() => router.push('/admin')}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Settings & Catalog</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg text-sm font-bold text-neutral-900 shadow-sm transition-all">
              <Users className="h-4 w-4" />
              <span>Team Members</span>
            </button>
            <button 
              onClick={() => router.push('/audit')}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Audit Trail</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        


        {/* Team Members Grid Container */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 border-b border-neutral-100 pb-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-neutral-800" />
              <h2 className="text-base font-bold text-neutral-900 font-sans">Active Organization Directory</h2>
            </div>
            <button
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Member</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading directory...</div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400">No members found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-2">Member Name</th>
                    <th className="py-2.5 px-2">Email Address</th>
                    <th className="py-2.5 px-2">Role Clearance</th>
                    <th className="py-2.5 px-2">Date Onboarded</th>
                    <th className="py-2.5 px-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.map((member) => {
                    const isSelf = member.id === currentUser?.id;
                    return (
                      <tr key={member.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3.5 px-2 font-medium text-neutral-900 flex items-center space-x-2">
                          <div className="w-7 h-7 bg-neutral-100 rounded-full flex items-center justify-center font-bold text-neutral-700 uppercase">
                            {member.name.charAt(0)}
                          </div>
                          <span>
                            {member.name} {isSelf && <strong className="text-[10px] text-neutral-400 font-normal uppercase tracking-wider">(You)</strong>}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-neutral-500">{member.email}</td>
                        <td className="py-3.5 px-2">
                          <select
                            disabled={isSelf}
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, member.name, e.target.value as 'ADMIN' | 'ANALYST')}
                            className="bg-neutral-50 border border-neutral-200 rounded-lg p-1 text-xs font-bold text-neutral-800 outline-none focus:bg-white disabled:opacity-50 disabled:bg-neutral-50 disabled:cursor-not-allowed"
                          >
                            <option value="ANALYST">Analyst clearance</option>
                            <option value="ADMIN">Administrator clearance</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-2 text-neutral-400">
                          {new Date(member.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          <button
                            disabled={isSelf}
                            onClick={() => handleRemoveUser(member.id, member.name)}
                            className="p-1.5 rounded hover:text-red-600 text-neutral-400 hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? 'Self deletion blocked' : `Remove ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* DIALOG: INVITE MEMBER */}
      {/* ============================================================== */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <div className="flex items-center space-x-2 border-b border-neutral-100 pb-3 mb-4">
              <UserPlus className="h-5 w-5 text-neutral-900" />
              <h3 className="text-base font-bold text-neutral-900">Add Team Member</h3>
            </div>
            
            {inviteError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">FULL NAME</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <UserCheck className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input 
                    type="text" 
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full p-2.5 pl-9 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">EMAIL ADDRESS</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full p-2.5 pl-9 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">INITIAL PASSWORD</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full p-2.5 pl-9 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CLEARANCE LEVEL</label>
                <select
                  required
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'ANALYST')}
                  className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none font-bold text-neutral-800"
                >
                  <option value="ANALYST">Analyst clearance</option>
                  <option value="ADMIN">Administrator clearance</option>
                </select>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSubmittingInvite ? 'Registering...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
