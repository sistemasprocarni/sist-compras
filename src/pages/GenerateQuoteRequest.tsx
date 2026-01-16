import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';

const GenerateQuoteRequest = () => {
  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Generar Solicitud de Cotización (SC)</CardTitle>
          <CardDescription>Crea una nueva solicitud de cotización para tus proveedores.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 text-center p-8">
            <h3 className="text-xl font-bold tracking-tight">
              Funcionalidad en desarrollo
            </h3>
            <p className="text-sm text-muted-foreground">
              Esta sección estará disponible pronto.
            </p>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default GenerateQuoteRequest;