import { supabase } from '../supabaseClient';

export const ContractService = {

    getAllContracts: async () => {
        const { data, error } = await supabase
            .from('contracts')
            .select(`
                id,
                codigo,
                nombre,
                concurso,
                contrato_legal,
                proveedor,
                precio_unitario,
                fecha_inicio,
                moneda
            `);

        if (error) throw error;

        return data.map(c => ({
            id: c.id,
            codigo: c.codigo,
            nombre: c.nombre,
            concurso: c.concurso,
            contratoLegal: c.contrato_legal,
            proveedor: c.proveedor,
            precioUnitario: c.precio_unitario,
            fechaInicio: c.fecha_inicio,
            moneda: c.moneda
        })) || [];
    },

    getContractById: async (id) => {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Mock items for consistency until items table is fully integrated
        // (If we had Items table, we would fetch here)
        return {
            id: data.id,
            codigo: data.codigo,
            nombre: data.nombre,
            concurso: data.concurso,
            contratoLegal: data.contrato_legal,
            proveedor: data.proveedor,
            precioUnitario: data.precio_unitario,
            fechaInicio: data.fecha_inicio,
            moneda: data.moneda,
            items: [{
                id: data.id + '_item',
                codigo: data.codigo,
                nombre: data.nombre,
                precioUnitario: data.precio_unitario,
                moneda: data.moneda
            }]
        };
    },

    createContract: async (contractData, initialPeriodData) => {
        // The Wizard sends { items: [...] } but DB expects flat fields.
        // We take the first item as the primary contract info.
        const primaryItem = contractData.items && contractData.items[0] ? contractData.items[0] : {};

        const dbPayload = {
            codigo: primaryItem.codigo || contractData.codigo,
            nombre: primaryItem.nombre || contractData.nombre,
            concurso: contractData.concurso,
            contrato_legal: contractData.contratoLegal,
            proveedor: contractData.proveedor,
            precio_unitario: parseFloat(primaryItem.precioUnitario || contractData.precioUnitario || 0),
            fecha_inicio: initialPeriodData?.fechaInicio || contractData.fechaInicio, // Usually in period, but maybe useful here
            moneda: primaryItem.moneda || contractData.moneda || 'USD'
        };

        const { data: contract, error: contractError } = await supabase
            .from('contracts')
            .insert([dbPayload])
            .select()
            .single();

        if (contractError) throw contractError;

        // Create Year 1 Period if data provided
        if (initialPeriodData) {
            const periodPayload = {
                contract_id: contract.id,
                nombre: 'Año 1',
                fecha_inicio: initialPeriodData.fechaInicio,
                fecha_fin: new Date(new Date(initialPeriodData.fechaInicio).setFullYear(new Date(initialPeriodData.fechaInicio).getFullYear() + 1)).toISOString(),
                presupuesto_asignado: parseFloat(initialPeriodData.presupuestoInicial),
                presupuesto_inicial: parseFloat(initialPeriodData.presupuestoInicial),
                estado: 'Activo',
                moneda: dbPayload.moneda
            };

            const { error: periodError } = await supabase.from('periods').insert([periodPayload]);
            if (periodError) console.error("Error creating initial period:", periodError);
        }

        return { ...contract, id: contract.id };
    },

    getPeriodsByContractId: async (contractId) => {
        const { data, error } = await supabase
            .from('periods')
            .select('*')
            .eq('contract_id', contractId)
            .order('fecha_inicio', { ascending: true });

        if (error) throw error;

        return data.map(p => ({
            id: p.id,
            contractId: p.contract_id,
            numeroAno: p.nombre, // Using 'nombre' for 'Año 1' etc
            fechaInicio: p.fecha_inicio,
            fechaFin: p.fecha_fin,
            presupuestoAsignado: p.presupuesto_asignado,
            presupuestoInicial: p.presupuesto_inicial,
            estado: p.estado,
            moneda: p.moneda // Optional, derived from contract usually but good if period specific
        }));
    },

    createPeriod: async (periodData) => {
        const dbPayload = {
            contract_id: periodData.contractId,
            nombre: periodData.numeroAno,
            fecha_inicio: periodData.fechaInicio,
            fecha_fin: periodData.fechaFin,
            presupuesto_asignado: parseFloat(periodData.presupuestoAsignado),
            presupuesto_inicial: parseFloat(periodData.presupuestoAsignado),
            estado: periodData.estado || 'Pendiente'
        };
        const { data, error } = await supabase.from('periods').insert([dbPayload]).select();
        if (error) throw error;
        return data[0];
    },

    getOrdersByPeriodId: async (periodId) => {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('period_id', periodId)
            .order('fecha_pedido', { ascending: false });

        if (error) throw error;

        return data.map(o => ({
            id: o.id,
            periodId: o.period_id,
            fechaPedido: o.fecha_pedido,
            numeroPedidoSAP: o.numero_pedido_sap,
            numeroPedidoSICOP: o.numero_pedido_sicop,
            // Check mapping compatibility with UI
            cantidadMedicamento: o.cantidad_medicamento,
            monto: o.monto,
            descripcion: o.descripcion,
            pur: o.pur,
            numeroReserva: o.numero_reserva,
            medicamentoId: o.item_id, // If linking to items
            // Legacy/Optional fields if flat structure
            medicamentoNombre: o.medicamento_nombre,
            medicamentoCodigo: o.medicamento_codigo
        }));
    },

    getAllOrdersWithDetails: async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                period:periods (
                    id,
                    contract:contracts (
                        id,
                        codigo,
                        nombre,
                        proveedor,
                        moneda
                    )
                )
            `)
            .order('fecha_pedido', { ascending: false });

        if (error) throw error;

        return data.map(o => ({
            id: o.id,
            periodId: o.period_id,
            fechaPedido: o.fecha_pedido,
            numeroPedidoSAP: o.numero_pedido_sap,
            numeroPedidoSICOP: o.numero_pedido_sicop,
            pur: o.pur,
            numeroReserva: o.numero_reserva,
            monto: o.monto,
            cantidadMedicamento: o.cantidad_medicamento,
            // Flatted details
            contractCode: o.period?.contract?.codigo || 'N/A',
            contractName: o.period?.contract?.nombre || 'N/A',
            supplierName: o.period?.contract?.proveedor || 'N/A',
            contractCurrency: o.period?.contract?.moneda || 'USD',
            medicamentoNombre: o.period?.contract?.nombre // Fallback if no specific item linkage
        }));
    },

    createOrder: async (orderData) => {
        const dbPayload = {
            period_id: orderData.periodId,
            fecha_pedido: orderData.fechaPedido,
            numero_pedido_sap: orderData.numeroPedidoSAP,
            numero_pedido_sicop: orderData.numeroPedidoSICOP,
            cantidad_medicamento: parseInt(orderData.cantidadMedicamento),
            monto: parseFloat(orderData.monto),
            pur: orderData.pur,
            numero_reserva: orderData.numeroReserva,
            descripcion: orderData.descripcion,
            // Restore item linkage
            item_id: orderData.medicamentoId,
            medicamento_nombre: orderData.medicamentoNombre,
            medicamento_codigo: orderData.medicamentoCodigo
        };
        const { data, error } = await supabase.from('orders').insert([dbPayload]).select();
        if (error) throw error;
        return data[0];
    },

    updateOrder: async (id, orderData) => {
        const dbPayload = {
            fecha_pedido: orderData.fechaPedido,
            numero_pedido_sap: orderData.numeroPedidoSAP,
            numero_pedido_sicop: orderData.numeroPedidoSICOP,
            cantidad_medicamento: parseInt(orderData.cantidadMedicamento),
            monto: parseFloat(orderData.monto),
            pur: orderData.pur,
            numero_reserva: orderData.numeroReserva,
            descripcion: orderData.descripcion,
            // Restore item linkage
            item_id: orderData.medicamentoId,
            medicamento_nombre: orderData.medicamentoNombre,
            medicamento_codigo: orderData.medicamentoCodigo
        };
        const { data, error } = await supabase.from('orders').update(dbPayload).eq('id', id).select();
        if (error) throw error;
        return data[0];
    },

    deleteOrder: async (id) => {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) throw error;
    },

    getInjectionsByPeriodId: async (periodId) => {
        const { data, error } = await supabase
            .from('injections')
            .select('*')
            .eq('period_id', periodId);

        if (error) throw error;
        return data.map(i => ({
            id: i.id,
            periodId: i.period_id,
            amount: i.amount,
            date: i.fecha,
            justification: i.descripcion
        })) || [];
    },

    getAllInjections: async () => {
        const { data, error } = await supabase
            .from('injections')
            .select(`
                *,
                period:periods (
                    id,
                    contract:contracts (
                        id,
                        codigo,
                        nombre,
                        contrato_legal,
                        proveedor,
                        concurso
                    )
                )
            `);

        if (error) throw error;

        return data.map(i => ({
            id: i.id,
            periodId: i.period_id,
            amount: i.amount,
            date: i.fecha,
            justification: i.descripcion,

            contractId: i.period?.contract?.id,
            contractCode: i.period?.contract?.codigo || 'N/A',
            contractLegal: i.period?.contract?.contrato_legal || 'N/A',
            contractName: i.period?.contract?.nombre || 'N/A',
            concurso: i.period?.contract?.concurso || 'N/A'
        }));
    },

    addBudgetInjection: async (injectionData) => {
        const dbPayload = {
            period_id: injectionData.periodId,
            amount: parseFloat(injectionData.amount),
            fecha: injectionData.date || new Date().toISOString(),
            descripcion: injectionData.oficioNumber || injectionData.justification || 'Inyección Presupuestaria'
        };
        const { data, error } = await supabase.from('injections').insert([dbPayload]).select();
        if (error) throw error;
        return data[0];
    },

    updateBudgetInjection: async (id, data) => {
        const dbPayload = {
            amount: parseFloat(data.amount),
            fecha: data.date,
            descripcion: data.oficioNumber || data.justification
        };
        const { error } = await supabase.from('injections').update(dbPayload).eq('id', id);
        if (error) throw error;
    },

    seedDatabase: async () => {
        // No-op for Supabase
    }
};
