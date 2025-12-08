
import { LayoutDashboard, FileText, Settings, PlusCircle, ClipboardList, TrendingUp, BarChart3 } from 'lucide-react';

export function Sidebar({ activeTab, onTabChange, onNewContract }) {
    const NavItem = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => onTabChange(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${activeTab === id
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                }`}
        >
            <Icon size={20} />
            {label}
        </button>
    );

    return (
        <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-card/30 backdrop-blur-xl p-4 flex flex-col z-50">
            <div className="mb-8 flex items-center gap-3 px-2 mt-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
                    <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight">MedControl</h1>
                    <p className="text-xs text-muted-foreground">Gestión de Contratos</p>
                </div>
            </div>

            <button
                onClick={onNewContract}
                className="btn btn-primary w-full mb-6 justify-center"
            >
                <PlusCircle className="w-4 h-4" />
                Nuevo Contrato
            </button>

            <nav className="flex flex-col gap-2 flex-1">
                <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
                <NavItem id="contracts" icon={FileText} label="Contratos" />
                <NavItem id="orders" icon={ClipboardList} label="Historial de Pedidos" />
                <NavItem id="injections" icon={TrendingUp} label="Inyec. Presup" />
                <NavItem id="budget_history" icon={FileText} label="Historial Inyecciones" />
                <NavItem id="statistics" icon={BarChart3} label="Estadísticas" />
                <NavItem id="settings" icon={Settings} label="Configuración" />
            </nav>

            <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10">
                <p className="text-xs font-medium text-primary mb-1">Estado del Sistema</p>
                <p className="text-xs text-muted-foreground">v1.0.0 • En línea</p>
            </div>
        </aside>
    );
}
