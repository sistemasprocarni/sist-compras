import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserCircle, Settings } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

const UserDropdown = () => {
  const { session, supabase } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      showError('Error al cerrar sesión.');
    } else {
      showSuccess('Sesión cerrada exitosamente.');
      navigate('/login');
    }
  };
  
  const handleAccountSettings = () => {
    navigate('/account-settings');
  };

  if (!session?.user) {
    return null; // No mostrar si no hay usuario logueado
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:text-procarni-primary h-9 px-3">
          <UserCircle className="mr-2 h-4 w-4" />
          <span className="truncate text-sm">{session.user.email || 'Usuario'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="truncate">{session.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleAccountSettings} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Configuración de Cuenta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;