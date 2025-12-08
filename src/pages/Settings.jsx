import { Construction } from 'lucide-react';

export function Settings() {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Construction className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Configuración</h1>
            <p className="text-muted-foreground max-w-md">
                El módulo de configuración está actualmente en desarrollo. Próximamente podrás gestionar usuarios, alertas y parámetros del sistema aquí.
            </p>
        </div>
    );
}
