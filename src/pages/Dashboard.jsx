import { useState, useEffect } from 'react';
import { KPICard } from '../components/KPICard';
import { ContractService } from '../services/ContractService';
import { DollarSign, AlertCircle, Clock, FileCheck, Activity } from 'lucide-react';

export function Dashboard({ onNavigate, searchTerm = '' }) {
    const [contracts, setContracts] = useState([]);
    const [stats, setStats] = useState({
        totalContracts: 0,
        activeContracts: 0,
        criticalContracts: 0,
        expiringContracts: 0,
        budgetCRC: 0,
        budgetUSD: 0,
        executedCRC: 0,
        executedUSD: 0
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                setLoading(true);
                const rawContracts = await ContractService.getAllContracts();
                const allInjections = await ContractService.getAllInjections();

                const enhancedList = await Promise.all(rawContracts.map(async (c) => {
                    const periods = await ContractService.getPeriodsByContractId(c.id);
                    if (periods.length === 0) return { ...c, execution: 0, expirationDate: null };

                    const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];
                    const periodInjections = allInjections.filter(i => String(i.periodId) === String(activePeriod.id));
                    const totalInjected = periodInjections.reduce((sum, i) => sum + parseFloat(i.amount), 0);

                    const initialBudget = parseFloat(activePeriod.presupuestoAsignado || 0);
                    const currentBudget = initialBudget + totalInjected;

                    const orders = await ContractService.getOrdersByPeriodId(activePeriod.id);
                    const totalExecuted = orders.reduce((sum, o) => sum + parseFloat(o.monto), 0);

                    const percent = currentBudget > 0 ? (totalExecuted / currentBudget) * 100 : 0;

                    return {
                        ...c,
                        execution: Math.min(percent, 100),
                        executedAmount: totalExecuted,
                        budget: currentBudget,
                        moneda: activePeriod.moneda || c.moneda,
                        expirationDate: activePeriod.fechaFin, // Cache for stats
                        periodNames: periods.map(p => p.nombre) // Add period names for display
                    };

                }));

                // Sort contracts by first medication name
                enhancedList.sort((a, b) => {
                    const nameA = (a.items && a.items.length > 0)
                        ? [...a.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                        : a.nombre;
                    const nameB = (b.items && b.items.length > 0)
                        ? [...b.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                        : b.nombre;
                    return nameA.localeCompare(nameB);
                });

                setContracts(enhancedList);

                // Calc stats from enhancedList
                const today = new Date();
                const ninetyDays = new Date();
                ninetyDays.setDate(today.getDate() + 90);

                const expiring = enhancedList.filter(c => {
                    if (!c.expirationDate) return false;
                    const end = new Date(c.expirationDate);
                    return end >= today && end <= ninetyDays;
                }).length;

                const totals = enhancedList.reduce((acc, curr) => {
                    let rawCurrency = (curr.moneda || 'USD').toUpperCase();
                    const isCRC = rawCurrency.includes('COLONES') || rawCurrency.includes('CRC');
                    if (isCRC) {
                        acc.budgetCRC += (curr.budget || 0);
                        acc.executedCRC += (curr.executedAmount || 0);
                    } else {
                        acc.budgetUSD += (curr.budget || 0);
                        acc.executedUSD += (curr.executedAmount || 0);
                    }
                    return acc;
                }, { budgetCRC: 0, budgetUSD: 0, executedCRC: 0, executedUSD: 0 });

                setStats({
                    totalContracts: enhancedList.length,
                    activeContracts: enhancedList.length,
                    criticalContracts: enhancedList.filter(c => c.execution > 90).length,
                    expiringContracts: expiring,
                    budgetCRC: totals.budgetCRC,
                    budgetUSD: totals.budgetUSD,
                    executedCRC: totals.executedCRC,
                    executedUSD: totals.executedUSD
                });

            } catch (err) {
                console.error("Error loading dashboard:", err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    if (loading) {
        return <div className="p-8 text-center">Cargando Dashboard...</div>;
    }

    // Helper for traffic light color system
    const getExecutionColor = (percentage) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 75) return 'bg-orange-500';
        if (percentage >= 50) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="space-y-6">
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Ejecución Global"
                    value={
                        (stats.budgetUSD > 0 && stats.budgetCRC > 0)
                            ? `${((stats.executedUSD / stats.budgetUSD) * 100).toFixed(1)}% / ${((stats.executedCRC / stats.budgetCRC) * 100).toFixed(1)}%`
                            : stats.budgetUSD > 0
                                ? `${((stats.executedUSD / stats.budgetUSD) * 100).toFixed(1)}%`
                                : `${stats.budgetCRC > 0 ? ((stats.executedCRC / stats.budgetCRC) * 100).toFixed(1) : 0}%`
                    }
                    subtext={stats.budgetUSD > 0 && stats.budgetCRC > 0 ? "USD / CRC" : "Promedio Ponderado"}
                    trend={0}
                    icon={Activity}
                />
                <KPICard
                    title="Contratos Activos"
                    value={stats.activeContracts}
                    subtext="En ejecución normal"
                    icon={FileCheck}
                />
                <KPICard
                    title="Por Vencer (< 90 días)"
                    value={stats.expiringContracts}
                    subtext="Requieren atención"
                    trend={0}
                    icon={Clock}
                />
                <KPICard
                    title="Presupuesto Total"
                    value={
                        <div>
                            {stats.budgetUSD > 0 && <div>${stats.budgetUSD.toLocaleString()}</div>}
                            {stats.budgetCRC > 0 && <div>₡{stats.budgetCRC.toLocaleString()}</div>}
                            {stats.budgetUSD === 0 && stats.budgetCRC === 0 && "$0"}
                        </div>
                    }
                    subtext="Año Fiscal 2025"
                    icon={DollarSign}
                />
            </div>

            {/* Recent Activity / Critical List */}
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold">
                        Contratos Recientes
                        {searchTerm && <span className="ml-2 text-sm font-normal text-muted-foreground">Resultados para: "{searchTerm}"</span>}
                    </h3>
                    <button className="btn btn-ghost text-sm text-primary">Ver todos</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Ref. Legal</th>

                                <th className="px-4 py-3">Periodo</th>
                                <th className="px-4 py-3">Medicamento</th>
                                <th className="px-4 py-3">Proveedor</th>
                                <th className="px-4 py-3">Estado</th>
                                <th className="px-4 py-3 rounded-r-lg">Ejecución</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.filter(c => {
                                if (!searchTerm) return true;
                                const term = searchTerm.toLowerCase();
                                return (
                                    (c.nombre || '').toLowerCase().includes(term) ||
                                    (c.codigo || '').toLowerCase().includes(term) ||
                                    (c.proveedor || '').toLowerCase().includes(term)
                                );
                            }).map(contract => (
                                <tr
                                    key={contract.id}
                                    onClick={() => onNavigate('details', contract.id)}
                                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1 text-sm text-muted-foreground w-full items-center justify-center min-h-[1.5rem]">
                                            {contract.concurso && <div><span className="font-semibold">Conc:</span> {contract.concurso}</div>}
                                            {contract.contratoLegal && <div><span className="font-semibold">Cont:</span> {contract.contratoLegal}</div>}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-center align-top font-medium text-xs">
                                        <div className="flex flex-wrap gap-1 justify-center min-h-[1.5rem] items-center">
                                            {contract.periodNames && contract.periodNames.length > 0 ? (
                                                contract.periodNames.map((p, idx) => (
                                                    <span key={idx} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                                                        {p}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-muted-foreground italic">-</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {contract.items?.length > 0 ? (
                                            <div className="flex flex-col gap-1 items-center">
                                                {[...contract.items].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((item, idx) => (
                                                    <div key={idx} className="h-6 flex items-center justify-center text-sm truncate max-w-[200px]" title={item.nombre}>
                                                        {item.nombre} ({item.codigo})
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                {contract.nombre} {contract.codigo ? `(${contract.codigo})` : ''}
                                            </>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top">{contract.proveedor}</td>
                                    <td className="px-4 py-3 align-top">
                                        <span className="badge badge-active">Activo</span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-center justify-center gap-2 h-6">
                                            <div className="w-24 bg-muted rounded-full h-1.5 flex-shrink-0">
                                                <div
                                                    className={`h-1.5 rounded-full ${getExecutionColor(contract.execution)}`}
                                                    style={{ width: `${contract.execution}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-muted-foreground w-8 text-right">{(contract.execution || 0).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {/* Empty State */}
                            {contracts.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-muted-foreground">
                                        No hay contratos registrados.
                                    </td>
                                </tr>
                            )}
                            {/* No Filter Results State */}
                            {contracts.length > 0 && contracts.filter(c =>
                                !searchTerm ||
                                c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.proveedor.toLowerCase().includes(searchTerm.toLowerCase())
                            ).length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-muted-foreground">
                                            No se encontraron contratos que coincidan con "{searchTerm}".
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
