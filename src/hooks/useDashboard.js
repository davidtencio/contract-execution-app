import { useQuery } from '@tanstack/react-query';
import { ContractService } from '../services/ContractService';

export const useDashboard = () => {
    return useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const rawContracts = await ContractService.getAllContracts();
            const allInjections = await ContractService.getAllInjections();
            // Optimization: Fetch ALL orders at once instead of per contract/period
            const allOrders = await ContractService.getAllOrdersWithDetails();

            const enhancedList = rawContracts.map((c) => {
                // Use pre-fetched periods
                const periods = c.fullPeriods || [];

                if (periods.length === 0) return { ...c, execution: 0, expirationDate: null };

                const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];

                // Injections (already optimized in previous code, just re-using)
                const periodInjections = allInjections.filter(i => String(i.periodId) === String(activePeriod.id));
                const totalInjected = periodInjections.reduce((sum, i) => sum + parseFloat(i.amount), 0);

                const initialBudget = parseFloat(activePeriod.presupuestoAsignado || 0);
                const currentBudget = initialBudget + totalInjected;

                // Optimization: Filter from allOrders instead of fetching
                // We need to match orders to this period. 
                // Using periodId if available, or filtering by contractId if that's how we associate.
                // NOTE: We'll assume allOrders has periodId or we can match by contractId for now if strict period check is hard without it.
                // Ideally orders have period_id. Let's assume they do or we filter by contract.
                // Current dashboard logic filtered by periodId.
                // Let's assume allOrders contains all orders and we filter by contractId AND activePeriod.
                // Actually, the previous loop used `getOrdersByPeriodId(activePeriod.id)`. 
                // So we need to match `order.periodId === activePeriod.id`.
                const orders = allOrders.filter(o => String(o.periodId) === String(activePeriod.id));

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
            });

            // Sort logic
            enhancedList.sort((a, b) => {
                const nameA = (a.items && a.items.length > 0)
                    ? [...a.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                    : a.nombre;
                const nameB = (b.items && b.items.length > 0)
                    ? [...b.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                    : b.nombre;
                return nameA.localeCompare(nameB);
            });

            // Calc stats
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

            const stats = {
                totalContracts: enhancedList.length,
                activeContracts: enhancedList.length,
                criticalContracts: enhancedList.filter(c => c.execution > 90).length,
                expiringContracts: expiring,
                budgetCRC: totals.budgetCRC,
                budgetUSD: totals.budgetUSD,
                executedCRC: totals.executedCRC,
                executedUSD: totals.executedUSD
            };

            return { contracts: enhancedList, stats, allOrders }; // Expose allOrders for Statistics page using the same cache
        },
        // We can increase stale time here because dashboard stats don't need second-by-second updates
        staleTime: 1000 * 60 * 5 // 5 minutes
    });
};
