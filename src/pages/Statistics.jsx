import { useState, useEffect, useMemo } from 'react';
import { ContractService } from '../services/ContractService';
import { KPICard } from '../components/KPICard';
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, Package } from 'lucide-react';

export function Statistics() {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        globalExecutionUSD: { budget: 0, executed: 0 },
        globalExecutionCRC: { budget: 0, executed: 0 },
        topContracts: [],
        expiringContracts: [],
        topMedications: [],
        monthlyTrend: []
    });

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Increased interval for network
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const contracts = await ContractService.getAllContracts() || [];
            const allOrders = await ContractService.getAllOrdersWithDetails() || [];
            const allInjections = await ContractService.getAllInjections() || [];

            // 1. Financials (USD & CRC)
            // Parallel fetch optimization not easily possible here without massive refactor of reduce logic
            // We need to fetch periods for each contract used in calculation.
            // Let's pre-fetch everything we can.

            // To avoid N+1 in reduce, we will fetch all periods for all contracts first? 
            // "getAllPeriods" doesn't exist. We have to map over contracts.
            // This is heavy.

            const contractsWithPeriods = await Promise.all(contracts.map(async c => {
                const periods = await ContractService.getPeriodsByContractId(c.id);
                return { ...c, periods };
            }));

            const financials = await contractsWithPeriods.reduce(async (accPromise, contract) => {
                const acc = await accPromise;
                const periods = contract.periods || [];
                const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];
                if (!activePeriod) return acc;

                // Determine currency
                let currency = (activePeriod.moneda || contract.moneda || 'USD').toUpperCase();
                const isCRC = currency.includes('COLONES') || currency.includes('CRC');
                const target = isCRC ? acc.crc : acc.usd;

                // Budget
                const initial = parseFloat(activePeriod.presupuestoAsignado || 0);
                const injected = allInjections
                    .filter(i => String(i.periodId) === String(activePeriod.id))
                    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
                target.budget += (initial + injected);

                // Execution
                // Need orders for this period. 
                // We have allOrders (detailed), we can filter them by periodId?
                // Problem: allOrders from getAllOrdersWithDetails might not have periodId directly if flatten logic dropped it? 
                // Let's check Service: getAllOrdersWithDetails returns id, periodId (from simple join potentially). 
                // Wait, the new Service implementation of getAllOrdersWithDetails DOES NOT return `periodId` explicitly in the top level select if I didn't verify it. 
                // Checking Service: select(..., periodId: ID_Periodo, ...) -> It DOES NOT in the flatten map. 
                // I need to use getOrdersByPeriodId OR rely on allOrders having it.
                // Let's fetch orders for period to be safe/consistent with Dashboard logic

                const orders = await ContractService.getOrdersByPeriodId(activePeriod.id);
                const executed = orders.reduce((sum, o) => sum + parseFloat(o.monto), 0);
                target.executed += executed;

                return acc;
            }, Promise.resolve({ usd: { budget: 0, executed: 0 }, crc: { budget: 0, executed: 0 } }));

            // 2. Top Contracts by Execution %
            const enhancedContracts = await Promise.all(contractsWithPeriods.map(async c => {
                const periods = c.periods;
                const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];
                if (!activePeriod) return null;

                const initial = parseFloat(activePeriod.presupuestoAsignado || 0);
                const injected = allInjections
                    .filter(i => String(i.periodId) === String(activePeriod.id))
                    .reduce((sum, i) => sum + parseFloat(i.amount), 0);
                const totalBudget = initial + injected;

                const orders = await ContractService.getOrdersByPeriodId(activePeriod.id);
                const executed = orders.reduce((sum, o) => sum + parseFloat(o.monto), 0);

                const percentage = totalBudget > 0 ? (executed / totalBudget) * 100 : 0;

                return {
                    ...c,
                    percentage,
                    totalBudget,
                    executed
                };
            }));

            // Deduplicate by code (keep highest percentage)
            const uniqueContractsMap = new Map();
            enhancedContracts.filter(Boolean).forEach(c => {
                const key = c.codigo || c.nombre;
                if (!uniqueContractsMap.has(key) || uniqueContractsMap.get(key).percentage < c.percentage) {
                    uniqueContractsMap.set(key, c);
                }
            });

            const topContracts = Array.from(uniqueContractsMap.values())
                .sort((a, b) => b.percentage - a.percentage)
                .slice(0, 10);

            // 3. Expiring Contracts (< 90 days)
            const today = new Date();
            const ninetyDays = new Date();
            ninetyDays.setDate(today.getDate() + 90);

            const expiring = contractsWithPeriods.map(c => {
                const periods = c.periods;
                const activePeriod = periods.find(p => p.estado === 'Activo');
                if (!activePeriod) return null;
                const end = new Date(activePeriod.fechaFin);
                if (end >= today && end <= ninetyDays) {
                    return { ...c, expirationDate: activePeriod.fechaFin };
                }
                return null;
            }).filter(Boolean);

            // 4. Top Medications
            const medicationMap = {};
            // allOrders has medicine name flattened
            allOrders.forEach(order => {
                const name = order.medicamentoNombre || order.contractName || 'Desconocido';
                const amount = parseFloat(order.monto);
                const currency = order.contractCurrency || 'CRC';

                const amountInUSD = currency === 'CRC' ? amount / 500 : amount;

                if (!medicationMap[name]) {
                    medicationMap[name] = { name, totalUSD: 0, count: 0 };
                }
                medicationMap[name].totalUSD += amountInUSD;
                medicationMap[name].count += 1;
            });

            const topMeds = Object.values(medicationMap)
                .sort((a, b) => b.totalUSD - a.totalUSD)
                .slice(0, 5);

            setStats({
                globalExecutionUSD: financials.usd,
                globalExecutionCRC: financials.crc,
                topContracts: topContracts,
                expiringContracts: expiring,
                topMedications: topMeds,
                monthlyTrend: calculateMonthlyTrend(allOrders)
            });
            setError(null);
        } catch (err) {
            console.error("Statistics Error:", err);
            setError("Error al cargar estadísticas: " + err.message);
        }
    };

    const calculateMonthlyTrend = (orders) => {
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last6Months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleString('es-ES', { month: 'short' }),
                total: 0
            });
        }

        orders.forEach(o => {
            if (!o.fechaPedido) return;
            const d = new Date(o.fechaPedido);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const match = last6Months.find(m => m.key === key);
            if (match) {
                // Normalize to simplified USD for viz
                let val = parseFloat(o.monto);
                // Heuristic: if amount > 1,000,000 assume CRC, divide by 500
                if (val > 1000000) val = val / 500;
                match.total += val;
            }
        });

        // Normalize for height (0-100%)
        const max = Math.max(...last6Months.map(m => m.total)) || 1;
        return last6Months.map(m => ({ ...m, percent: (m.total / max) * 100 }));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Tablero de Estadísticas</h1>
                <p className="text-muted-foreground">
                    Análisis en tiempo real de la ejecución presupuestaria y operativa.
                </p>
                {error && (
                    <div className="mt-4 p-4 text-red-700 bg-red-100 rounded-lg border border-red-200">
                        {error}
                    </div>
                )}
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* USD Card */}
                <div className="card bg-gradient-to-br from-card to-blue-500/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Ejecución Global (USD)</h3>
                            <p className="text-sm text-muted-foreground">Presupuesto en Dólares</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="text-3xl font-bold">${stats.globalExecutionUSD.executed.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground mb-1">
                                de ${stats.globalExecutionUSD.budget.toLocaleString()}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-4 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-1000"
                                style={{
                                    width: `${stats.globalExecutionUSD.budget > 0
                                        ? Math.min((stats.globalExecutionUSD.executed / stats.globalExecutionUSD.budget) * 100, 100)
                                        : 0}%`
                                }}
                            />
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                            {stats.globalExecutionUSD.budget > 0
                                ? ((stats.globalExecutionUSD.executed / stats.globalExecutionUSD.budget) * 100).toFixed(1)
                                : 0}% Ejecutado
                        </div>
                    </div>
                </div>

                {/* CRC Card */}
                <div className="card bg-gradient-to-br from-card to-green-500/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Ejecución Global (CRC)</h3>
                            <p className="text-sm text-muted-foreground">Presupuesto en Colones</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="text-3xl font-bold">₡{stats.globalExecutionCRC.executed.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground mb-1">
                                de ₡{stats.globalExecutionCRC.budget.toLocaleString()}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-4 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-1000"
                                style={{
                                    width: `${stats.globalExecutionCRC.budget > 0
                                        ? Math.min((stats.globalExecutionCRC.executed / stats.globalExecutionCRC.budget) * 100, 100)
                                        : 0}%`
                                }}
                            />
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                            {stats.globalExecutionCRC.budget > 0
                                ? ((stats.globalExecutionCRC.executed / stats.globalExecutionCRC.budget) * 100).toFixed(1)
                                : 0}% Ejecutado
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Trend Chart */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-semibold text-lg">Tendencia de Gasto (Últimos 6 Meses)</h3>
                </div>
                <div className="flex items-end justify-between h-48 gap-2 pt-4 pb-2">
                    {stats.monthlyTrend?.map((month, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group gap-2">
                            {/* Value Label - Always visible now */}
                            <div className="text-[10px] font-bold text-muted-foreground mb-1 text-center">
                                ${month.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>

                            {/* Bar Container */}
                            <div className="w-full max-w-[32px] bg-muted/30 rounded-t-sm relative h-32 flex items-end overflow-hidden">
                                <div
                                    className="w-full bg-indigo-500 rounded-t-sm transition-all duration-1000 ease-out group-hover:bg-indigo-400"
                                    style={{ height: `${Math.max(month.percent, 2)}%` }} // Min 2% visibility
                                >
                                </div>
                            </div>

                            {/* Month Label */}
                            <span className="text-xs text-muted-foreground font-medium uppercase">{month.label}</span>
                        </div>
                    ))}
                    {(!stats.monthlyTrend || stats.monthlyTrend.length === 0) && (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            Cargando datos...
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Execute Contracts */}
                <div className="card">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                        <h3 className="font-semibold text-lg">Mayor Ejecución Presupuestaria</h3>
                    </div>
                    <div className="space-y-4">
                        {stats.topContracts.map(c => (
                            <div key={c.id} className="space-y-2 p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm truncate w-full" title={c.nombre}>
                                            {c.nombre} <span className="text-xs text-muted-foreground">({c.codigo})</span>
                                        </span>
                                        <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                                            <span>Concurso: {c.concurso || 'N/A'}</span>
                                            <span>•</span>
                                            <span>Contrato: {c.contratoLegal || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <span className="font-bold text-orange-600 whitespace-nowrap">{c.percentage.toFixed(1)}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-orange-500"
                                        style={{ width: `${Math.min(c.percentage, 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {stats.topContracts.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">Sin datos suficientes</div>
                        )}
                    </div>
                </div>

                {/* Operations & Products */}
                <div className="space-y-6">
                    {/* Expiring Contracts */}
                    <div className="card border-l-4 border-l-red-500">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h3 className="font-semibold text-lg">Riesgo de Vencimiento (&lt; 90 días)</h3>
                        </div>
                        {stats.expiringContracts.length > 0 ? (
                            <div className="space-y-3">
                                {stats.expiringContracts.map(c => (
                                    <div key={c.id} className="flex justify-between items-center p-2 bg-red-500/5 rounded-lg border border-red-500/20 text-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className="font-semibold whitespace-nowrap">Contrato: {c.contratoLegal || c.codigo}</span>
                                            <span className="text-muted-foreground truncate">
                                                | Concurso: {c.concurso || 'N/A'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap ml-2">
                                            Vence: {new Date(c.expirationDate).toLocaleDateString('es-ES')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-green-600 flex items-center gap-2 py-4">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                No hay contratos próximos a vencer.
                            </div>
                        )}
                    </div>

                    {/* Top Products */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="w-5 h-5 text-purple-500" />
                            <h3 className="font-semibold text-lg">Top Productos (Gasto Est.)</h3>
                        </div>
                        <div className="space-y-3">
                            {stats.topMedications.map((med, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs ring-2 ring-white">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{med.name}</div>
                                        <div className="text-xs text-muted-foreground">{med.count} pedidos realizados</div>
                                    </div>
                                </div>
                            ))}
                            {stats.topMedications.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">Sin pedidos registrados</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
