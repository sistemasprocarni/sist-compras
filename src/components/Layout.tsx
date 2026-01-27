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

  const Sidebar = () => (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 bg-procarni-primary text-white">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <img src="/Sis-Prov.png" alt="Logo" className="h-10 w-auto" onError={(e) => e.currentTarget.style.display='none'} />
          <span>Procarni System</span>
        </NavLink>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="mt-auto p-4 border-t">
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
        <SheetContent side="left" className="flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
          <div className="mt-auto p-4 border-t">
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
    <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full rounded-lg border">
      <ResizablePanel defaultSize={15} minSize={10} maxSize={20}>
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={85}>
        <div className="flex flex-col">
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
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
            <Outlet />
          </main>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default Layout;