import { MadeWithDyad } from "@/components/made-with-dyad";

const SearchManagement = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Búsqueda y Gestión
          </h3>
          <p className="text-sm text-muted-foreground">
            Aquí podrás buscar y gestionar proveedores, materiales y órdenes existentes.
          </p>
          {/* Futuro componente de búsqueda inteligente */}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SearchManagement;