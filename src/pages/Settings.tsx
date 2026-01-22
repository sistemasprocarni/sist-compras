import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Settings = () => {
  const { session } = useSession();
  const [startingNumber, setStartingNumber] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetSequence = async () => {
    if (!session) {
      showError('No hay sesión activa. Por favor, inicia sesión.');
      return;
    }

    setIsLoading(true);
    const toastId = showLoading('Actualizando secuencia de órdenes de compra...');

    try {
      const response = await fetch(
        `https://sbmwuttfblpwwwpifmza.supabase.co/functions/v1/set-po-sequence`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ startNumber: startingNumber }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar la secuencia.');
      }

      const result = await response.json();
      dismissToast(toastId);
      showSuccess(result.message || 'Secuencia actualizada exitosamente.');
    } catch (error: any) {
      console.error('[Settings] Error updating sequence:', error);
      dismissToast(toastId);
      showError(error.message || 'Error desconocido al actualizar la secuencia.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-procarni-primary">Configuración del Sistema</CardTitle>
          <CardDescription>
            Configura los parámetros generales del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="border p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Secuencia de Órdenes de Compra</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configura el número inicial para la secuencia de órdenes de compra. 
                Si ingresas 0, la secuencia se reiniciará y el próximo número será 1.
                Si ingresas un número distinto de 0 (ej. 5), el próximo número será ese.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="startingNumber">Número inicial</Label>
                  <Input
                    id="startingNumber"
                    type="number"
                    min="0"
                    value={startingNumber}
                    onChange={(e) => setStartingNumber(parseInt(e.target.value) || 0)}
                    placeholder="0 para reiniciar, o un número para iniciar desde allí"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleSetSequence} 
                    disabled={isLoading}
                    className="bg-procarni-secondary hover:bg-green-700"
                  >
                    {isLoading ? 'Actualizando...' : 'Actualizar Secuencia'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Settings;