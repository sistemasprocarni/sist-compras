import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MadeWithDyad } from './made-with-dyad';
import { useIsMobile } from '@/hooks/use-mobile';
import UserDropdown from './UserDropdown';
import SidebarNav from './SidebarNav';

const Layout = () => {
  const isMobile = useIsMobile();

  const SidebarHeader = () => (
    <div className="flex flex-col items-center justify-center py-4 border-b border-gray-200 bg-background dark:bg-gray-900">
      <NavLink to="/" className="flex flex-col items-center gap-2 font-semibold text-procarni-primary dark:text-white">
        <img 
          src="/Sis-Prov.png" 
          alt="Sis-Prov Logo" 
          className="h-10 w-auto object-contain drop-shadow-md" 
        />
      </NavLink>
    </div>
  );

  const Sidebar = () => (
    <div className="flex h-full max-h-screen flex-col gap-0 bg-sidebar text-sidebar-foreground border-r border-border">
      <SidebarHeader />
      <div className="flex-1 overflow-y-auto p-2">
        <SidebarNav />
      </div>
      <div className="mt-auto p-2 border-t border-gray-200 dark:border-gray-700">
        <UserDropdown />
      </div>
      <MadeWithDyad />
    </div>
  );

  const MobileHeader = () => (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <img src="/Sis-Prov.png" alt="Sis-Prov Logo" className="h-8 w-auto object-contain" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col bg-sidebar text-sidebar-foreground">
          <SidebarHeader />
          <div className="flex-1 overflow-y-auto p-2">
            <SidebarNav />
          </div>
          <div className="mt-auto p-2 border-t border-gray-200 dark:border-gray-700">
            <UserDropdown />
          </div>
        </SheetContent>
      </Sheet>
      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
            />
          </div>
        </form>
      </div>
    </header>
  );

  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <MobileHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen w-full rounded-lg border overflow-hidden">
      <ResizablePanel defaultSize={15} minSize={10} maxSize={20}>
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={85}>
        <div className="flex flex-col h-full">
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
            <div className="w-full flex-1">
              <form>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar..."
                    className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                  />
                </div>
              </form>
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default Layout;