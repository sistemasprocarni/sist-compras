import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Search, ArrowLeft, User, Mail, Tag } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { getAllProfiles, updateProfile } from '@/integrations/supabase/data';
import { showError, showSuccess } from '@/utils/toast';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Profile } from '@/integrations/supabase/types';
import ProfileForm from '@/components/ProfileForm';
import { cn } from '@/lib/utils';

const UserManagement = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: profiles, isLoading, error } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: getAllProfiles,
  });

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (!searchTerm) return profiles;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return profiles.filter(profile =>
      (profile.username && profile.username.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (profile.email && profile.email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (profile.first_name && profile.first_name.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (profile.last_name && profile.last_name.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [profiles, searchTerm]);

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Profile, 'id' | 'updated_at'>> }) =>
      updateProfile(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsFormOpen(false);
      setEditingProfile(null);
      showSuccess('Perfil actualizado exitosamente.');
    },
    onError: (err) => {
      showError(`Error al actualizar perfil: ${err.message}`);
    },
  });

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (data: any) => {
    if (editingProfile) {
      await updateMutation.mutateAsync({ id: editingProfile.id, updates: data });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-procarni-primary text-white';
      case 'user':
        return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 text-center text-muted-foreground">
        Cargando perfiles de usuario...
      </div>
    );
  }

  if (error) {
    showError(error.message);
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error al cargar los perfiles: {error.message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-procarni-primary">Gestión de Usuarios</CardTitle>
            <CardDescription>Administra los nombres de usuario y roles de los perfiles.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nombre de usuario, email o nombre completo..."
              className="w-full appearance-none bg-background pl-8 shadow-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredProfiles.length > 0 ? (
            isMobile ? (
              <div className="grid gap-4">
                {filteredProfiles.map((profile) => (
                  <Card key={profile.id} className="p-4 shadow-md">
                    <CardTitle className="text-lg mb-1 flex justify-between items-center">
                      {profile.username || 'N/A'}
                      <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", getRoleBadgeClass(profile.role))}>
                        {profile.role === 'admin' ? 'Admin' : 'Usuario'}
                      </span>
                    </CardTitle>
                    <CardDescription className="mb-2 flex items-center">
                      <Mail className="mr-1 h-3 w-3" /> {profile.email || 'N/A'}
                    </CardDescription>
                    <div className="text-sm space-y-1 mt-2 w-full">
                      <p><strong>Nombre:</strong> {profile.first_name || 'N/A'} {profile.last_name || ''}</p>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}
                        disabled={updateMutation.isPending}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((profile) => (
                      <TableRow key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <TableCell className="font-medium">{profile.username || 'N/A'}</TableCell>
                        <TableCell>{profile.email || 'N/A'}</TableCell>
                        <TableCell>{profile.first_name || 'N/A'} {profile.last_name || ''}</TableCell>
                        <TableCell>
                          <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", getRoleBadgeClass(profile.role))}>
                            {profile.role === 'admin' ? 'Administrador' : 'Usuario'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}
                            disabled={updateMutation.isPending}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div className="text-center text-muted-foreground p-8">
              No hay perfiles de usuario registrados o no se encontraron resultados para tu búsqueda.
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      {/* Dialog for editing profile */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]" description="Edita los detalles del perfil de usuario.">
          <DialogHeader>
            <DialogTitle>Editar Perfil: {editingProfile?.username}</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <ProfileForm
              initialData={editingProfile}
              onSubmit={handleSubmitForm}
              onCancel={() => setIsFormOpen(false)}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;