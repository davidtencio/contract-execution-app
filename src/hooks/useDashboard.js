import { useQuery } from '@tanstack/react-query';
import { ContractService } from '../services/ContractService';

export const useDashboard = () => {
    return useQuery({
        queryKey: ['dashboard'],
        queryFn: async () => {
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

            return { contracts: enhancedList, stats };
        },
        // We can increase stale time here because dashboard stats don't need second-by-second updates
        staleTime: 1000 * 60 * 5 // 5 minutes
    });
};
