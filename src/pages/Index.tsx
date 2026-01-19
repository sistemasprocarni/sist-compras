import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Bienvenido al Portal de Proveedores
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
          Aquí puedes gestionar tus proveedores y materiales.
        </p>
        <Link to="/bulk-upload">
          <Button className="bg-procarni-primary hover:bg-procarni-secondary text-white">
            Ir a Carga Masiva
          </Button>
        </Link>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;