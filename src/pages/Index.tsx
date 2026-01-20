"use client";

import React from 'react';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Index = () => {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-2xl font-bold tracking-tight">
          Bienvenido al Portal de Compras
        </h3>
        <p className="text-sm text-muted-foreground">
          Selecciona una opción del menú lateral para empezar.
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;