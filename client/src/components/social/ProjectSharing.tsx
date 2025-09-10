import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Share2, Users, Eye, Edit, Crown, UserPlus, X } from 'lucide-react';

interface ProjectShare {
  id: string;
  projectName: string;
  sharedWith: string;
  permission: 'view' | 'edit' | 'admin';
  sharedAt: Date;
}

interface ProjectCollaboration {
  id: string;
  userName: string;
  userAvatar?: string;
  role: 'owner' | 'collaborator' | 'viewer';
  joinedAt: Date;
  lastActive: Date;
}

interface ProjectSharingProps {
  projectId: string;
  projectName: string;
  currentUserRole: 'owner' | 'collaborator' | 'viewer';
}

export default function ProjectSharing({ projectId, projectName, currentUserRole }: ProjectSharingProps) {
  const { toast } = useToast();
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Fetch project shares
  const { data: shares, refetch: refetchShares } = useQuery({
    queryKey: ['projectShares', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/shares`);
      return await response.json();
    }
  });

  // Fetch project collaborators
  const { data: collaborators, refetch: refetchCollaborators } = useQuery({
    queryKey: ['projectCollaborators', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/collaborators`);
      return await response.json();
    }
  });

  // Share project mutation
  const shareMutation = useMutation({
    mutationFn: async (data: { email: string; permission: string }) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/share`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Project Shared",
        description: `Successfully shared "${projectName}" with ${shareEmail}`
      });
      setShareEmail('');
      setShowInviteForm(false);
      refetchShares();
    },
    onError: (error: any) => {
      toast({
        title: "Share Failed",
        description: error.message || "Could not share project",
        variant: "destructive"
      });
    }
  });

  // Update collaborator permission
  const updatePermissionMutation = useMutation({
    mutationFn: async (data: { collaboratorId: string; permission: string }) => {
      const response = await apiRequest('PUT', `/api/projects/${projectId}/collaborators/${data.collaboratorId}`, {
        permission: data.permission
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permission Updated",
        description: "Collaborator permissions have been updated"
      });
      refetchCollaborators();
    }
  });

  // Remove collaborator
  const removeCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const response = await apiRequest('DELETE', `/api/projects/${projectId}/collaborators/${collaboratorId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Collaborator Removed",
        description: "User has been removed from the project"
      });
      refetchCollaborators();
    }
  });

  const handleShare = () => {
    if (!shareEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }
    shareMutation.mutate({ email: shareEmail, permission: sharePermission });
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'admin': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'edit': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'view': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'collaborator': return <Users className="w-4 h-4 text-blue-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const canManageCollaborators = currentUserRole === 'owner';

  return (
    <Card className="w-full bg-gray-800 border-gray-600">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Share2 className="w-6 h-6 text-green-400" />
            Project Sharing & Collaboration
          </CardTitle>
          {canManageCollaborators && (
            <Button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="bg-green-600 hover:bg-green-500"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Collaborator
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-400">
          Share "{projectName}" with other musicians and collaborate together
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Invite Form */}
        {showInviteForm && canManageCollaborators && (
          <Card className="bg-gray-700 border-gray-600">
            <CardHeader>
              <CardTitle className="text-lg">Invite Collaborator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="collaborator@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="bg-gray-600 border-gray-500"
                  />
                </div>
                <div>
                  <Label htmlFor="permission">Permission Level</Label>
                  <Select value={sharePermission} onValueChange={(value: any) => setSharePermission(value)}>
                    <SelectTrigger className="bg-gray-600 border-gray-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          View Only
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center gap-2">
                          <Edit className="w-4 h-4" />
                          Can Edit
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4" />
                          Admin
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleShare}
                  disabled={shareMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {shareMutation.isPending ? 'Sharing...' : 'Share Project'}
                </Button>
                <Button
                  onClick={() => setShowInviteForm(false)}
                  variant="outline"
                  className="bg-gray-600 hover:bg-gray-500"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Collaborators */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Current Collaborators</h3>
          <div className="space-y-3">
            {collaborators?.map((collaborator: ProjectCollaboration) => (
              <div key={collaborator.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  {collaborator.userAvatar ? (
                    <img
                      src={collaborator.userAvatar}
                      alt={collaborator.userName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{collaborator.userName}</div>
                    <div className="text-sm text-gray-400">
                      {getRoleIcon(collaborator.role)}
                      <span className="ml-2 capitalize">{collaborator.role}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">
                    Last active: {new Date(collaborator.lastActive).toLocaleDateString()}
                  </div>

                  {canManageCollaborators && collaborator.role !== 'owner' && (
                    <div className="flex gap-2">
                      <Select
                        value={collaborator.role}
                        onValueChange={(value) => updatePermissionMutation.mutate({
                          collaboratorId: collaborator.id,
                          permission: value
                        })}
                      >
                        <SelectTrigger className="w-24 bg-gray-600 border-gray-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="collaborator">Edit</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        onClick={() => removeCollaboratorMutation.mutate(collaborator.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(!collaborators || collaborators.length === 0) && (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No collaborators yet</p>
                <p className="text-sm">Invite musicians to collaborate on this project</p>
              </div>
            )}
          </div>
        </div>

        {/* Project Shares */}
        {shares && shares.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Pending Shares</h3>
            <div className="space-y-3">
              {shares.map((share: ProjectShare) => (
                <div key={share.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">Shared with {share.sharedWith}</div>
                      <div className="text-sm text-gray-400">
                        {getPermissionIcon(share.permission)}
                        <span className="ml-2 capitalize">{share.permission} access</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(share.sharedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaboration Tips */}
        <Card className="bg-blue-900/20 border-blue-600/30">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-400 mb-2">💡 Collaboration Tips</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• <strong>Viewer:</strong> Can listen and comment on your project</li>
              <li>• <strong>Editor:</strong> Can modify tracks and arrangements</li>
              <li>• <strong>Admin:</strong> Can manage collaborators and project settings</li>
              <li>• <strong>Owner:</strong> Full control, including deleting the project</li>
            </ul>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
