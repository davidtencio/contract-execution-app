import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContractService } from '../services/ContractService';

export const useContracts = () => {
    return useQuery({
        queryKey: ['contracts'],
        queryFn: async () => {
            const data = await ContractService.getAllContracts();
            // Sort logic moved here to ensure consistency
            return data.sort((a, b) => {
                const nameA = (a.items && a.items.length > 0)
                    ? [...a.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                    : a.nombre;
                const nameB = (b.items && b.items.length > 0)
                    ? [...b.items].sort((x, y) => x.nombre.localeCompare(y.nombre))[0].nombre
                    : b.nombre;
                return nameA.localeCompare(nameB);
            });
        }
    });
};

export const useDeleteContract = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ContractService.deleteContract,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            // Also invalidate dashboard if we make a specific hook for it
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
    });
};
