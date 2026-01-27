"use client";

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, ShoppingCart, FileText, Factory, Users, Box, Upload, ClipboardList, Building2, ListOrdered, Settings, Cog, FileUp } from 'lucide-react';

const navItems = [
  {
    category: 'Gestión Principal',
    items: [
      { to: '/', icon: <Search className="h-5 w-5" />, label: 'Búsqueda / Gestión' },
      { to: '/supplier-management', icon: <Users className="h-5 w-5" />, label: 'Gestión de Proveedores' },
      { to: '/material-management', icon: <Box className="h-5 w-5" />, label: 'Gestión de Materiales' },
    ]
  },
  {
    category: 'Procesos',
    items: [
      { to: '/search-suppliers-by-material', icon: <Factory className="h-5 w-5" />, label: 'Buscar Proveedores por Material' },
      { to: '/generate-quote', icon: <FileText className="h-5 w-5" />, label: 'Generar Solicitud (SC)' },
      { to: '/quote-request-management', icon: <ClipboardList className="h-5 w-5" />, label: 'Gestión de Solicitudes (SC)' },
      { to: '/generate-po', icon: <ShoppingCart className="h-5 w-5" />, label: 'Generar Orden (OC)' },
      { to: '/purchase-order-management', icon: <ListOrdered className="h-5 w-5" />, label: 'Gestión de Órdenes (OC)' },
    ]
  },
  {
    category: 'Configuración',
    items: [
      { to: '/company-management', icon: <Building2 className="h-5 w-5" />, label: 'Gestión de Empresas' },
      { to: '/bulk-upload', icon: <Upload className="h-5 w-5" />, label: 'Carga Masiva' },
      { to: '/ficha-tecnica-upload', icon: <FileUp className="h-5 w-5" />, label: 'Subir Ficha Técnica' },
      { to: '/settings', icon: <Cog className="h-5 w-5" />, label: 'Secuencias' },
    ]
  }
];

const SidebarNav = () => {
  const [openItems, setOpenItems] = useState<string[]>(['Gestión Principal', 'Procesos', 'Configuración']);

  const handleValueChange = (value: string[]) => {
    setOpenItems(value);
  };

  return (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={handleValueChange}
      className="w-full"
    >
      {navItems.map((category) => (
        <AccordionItem key={category.category} value={category.category} className="border-b border-sidebar-border">
          <AccordionTrigger className="px-4 py-2 text-sm font-semibold text-sidebar-foreground hover:bg-muted/50 rounded-md">
            {category.category}
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <nav className="grid items-start px-2 text-sm font-medium">
              {category.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all 
                    ${
                      isActive 
                        ? 'bg-procarni-primary text-white' 
                        : 'text-sidebar-foreground hover:bg-procarni-primary/10 hover:text-procarni-primary'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

export default SidebarNav;