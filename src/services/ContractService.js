import { supabase } from '../supabaseClient';

export const ContractService = {

    getAllContracts: async () => {
        const { data, error } = await supabase
            .from('contracts')
            .select(`
                *,
                items:contract_items(*)
            `)
            .order('created_at', { ascending: false });

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
            moneda: c.moneda,
            items: c.items ? c.items.map(i => ({
                id: i.id,
                codigo: i.codigo,
                nombre: i.nombre,
                moneda: i.moneda,
                precioUnitario: i.precio_unitario
            })) : []
        })) || [];
    },

    getContractById: async (id) => {
        // Fetch Contract
        const { data: contract, error: contractError } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', id)
            .single();

        if (contractError) throw contractError;

        // Fetch Items
        const { data: items, error: itemsError } = await supabase
            .from('contract_items')
            .select('*')
            .eq('contract_id', id);

        if (itemsError) throw itemsError;

        return {
            id: contract.id,
            codigo: contract.codigo,
            nombre: contract.nombre,
            concurso: contract.concurso,
            contratoLegal: contract.contrato_legal,
            proveedor: contract.proveedor,
            precioUnitario: contract.precio_unitario,
            fechaInicio: contract.fecha_inicio,
            moneda: contract.moneda,
            items: items.map(i => ({
                id: i.id,
                codigo: i.codigo,
                nombre: i.nombre,
                moneda: i.moneda,
                precioUnitario: i.precio_unitario
            }))
        };
    },

    createContract: async (contractData, initialPeriodData) => {
        // 1. Insert Contract
        // Takes the first item as the "primary" info for the contract header if needed, 
        // but mostly we rely on the specific items list now.
        const primaryItem = contractData.items && contractData.items[0] ? contractData.items[0] : {};

        const dbPayload = {
            codigo: primaryItem.codigo || contractData.codigo || 'N/A', // Fallback
            nombre: primaryItem.nombre || contractData.nombre || 'Contrato General',
            concurso: contractData.concurso,
            contrato_legal: contractData.contratoLegal,
            proveedor: contractData.proveedor,
            precio_unitario: parseFloat(primaryItem.precioUnitario || 0), // Legacy field, keeping for now
            fecha_inicio: initialPeriodData?.fechaInicio || contractData.fechaInicio,
            moneda: primaryItem.moneda || 'USD' // Default currency
        };

        const { data: contract, error: contractError } = await supabase
            .from('contracts')
            .insert([dbPayload])
            .select()
            .single();

        if (contractError) throw contractError;

        // 2. Insert Items
        if (contractData.items && contractData.items.length > 0) {
            const itemsPayload = contractData.items.map(item => ({
                contract_id: contract.id,
                codigo: item.codigo,
                nombre: item.nombre,
                moneda: item.moneda,
                precio_unitario: parseFloat(item.precioUnitario)
            }));

            const { error: itemsError } = await supabase
                .from('contract_items')
                .insert(itemsPayload);

            if (itemsError) throw itemsError;
        }

        // 3. Create Initial Period if data provided
        if (initialPeriodData) {
            const durationYears = initialPeriodData.durationYears || 1;
            const startDate = new Date(initialPeriodData.fechaInicio);
            const endDate = new Date(startDate);
            endDate.setFullYear(startDate.getFullYear() + durationYears);

            // Adjust for end of day or -1 day if preferred, but usually straight year add is fine for legal logic often (minus 1 day)
            // But simplification: start Jan 1 2024 -> End Jan 1 2025. 
            // Better to do minus 1 day normally but sticking to simple FullYear add for now as placeholder

            const periodPayload = {
                contract_id: contract.id,
                nombre: initialPeriodData.nombre || 'Periodo 1', // Use provided name or default
                fecha_inicio: initialPeriodData.fechaInicio,
                fecha_fin: endDate.toISOString(),
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

    updateContract: async (id, contractData) => {
        // 1. Update Contract Details
        const { error: contractError } = await supabase
            .from('contracts')
            .update({
                proveedor: contractData.proveedor,
                concurso: contractData.concurso,
                contrato_legal: contractData.contratoLegal
            })
            .eq('id', id);

        if (contractError) throw contractError;

        // 2. Handle Items (Sync Strategy: Delete all and recreate is simplest for now, 
        // or smarter upsert. For this MVP, let's try upsert or delete/insert. 
        // Given we don't have stable IDs from frontend for new items reliably without complications, 
        // and volume is small (max 3 items), Delete + Insert is safest/easiest.

        // A. Delete existing items
        const { error: deleteError } = await supabase
            .from('contract_items')
            .delete()
            .eq('contract_id', id);

        if (deleteError) throw deleteError;

        // B. Insert new items
        if (contractData.items && contractData.items.length > 0) {
            const itemsPayload = contractData.items.map(item => ({
                contract_id: id,
                codigo: item.codigo,
                nombre: item.nombre,
                moneda: item.moneda,
                precio_unitario: parseFloat(item.precioUnitario)
            }));

            const { error: insertError } = await supabase
                .from('contract_items')
                .insert(itemsPayload);

            if (insertError) throw insertError;
        }
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
            nombre: periodData.nombre || periodData.numeroAno, // Flexible name
            fecha_inicio: periodData.fechaInicio,
            fecha_fin: periodData.fechaFin,
            presupuesto_asignado: parseFloat(periodData.presupuestoAsignado),
            presupuesto_inicial: parseFloat(periodData.presupuestoAsignado),
            estado: periodData.estado || 'Pendiente' // Default to Pendiente, usually explicit
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
        const sanitize = (val) => (val === '' || val === undefined || val === null ? null : val);
        const sanitizeBigInt = (val) => {
            if (!val) return null;
            if (typeof val === 'string' && val.includes('_')) return null;
            const num = parseInt(val);
            return isNaN(num) ? null : num;
        };

        const dbPayload = {
            period_id: orderData.periodId,
            fecha_pedido: orderData.fechaPedido,
            numero_pedido_sap: sanitize(orderData.numeroPedidoSAP),
            numero_pedido_sicop: sanitize(orderData.numeroPedidoSICOP),
            cantidad_medicamento: parseInt(orderData.cantidadMedicamento) || 0,
            monto: parseFloat(orderData.monto) || 0,
            pur: sanitize(orderData.pur),
            numero_reserva: sanitize(orderData.numeroReserva),
            descripcion: sanitize(orderData.descripcion),
            // Restore item linkage
            item_id: sanitizeBigInt(orderData.medicamentoId),
            medicamento_nombre: sanitize(orderData.medicamentoNombre),
            medicamento_codigo: sanitize(orderData.medicamentoCodigo)
        };
        const { data, error } = await supabase.from('orders').insert([dbPayload]).select();
        if (error) throw error;
        return data[0];
    },

    updateOrder: async (id, orderData) => {
        const sanitize = (val) => (val === '' || val === undefined || val === null ? null : val);
        const sanitizeBigInt = (val) => {
            if (!val) return null;
            if (typeof val === 'string' && val.includes('_')) return null;
            const num = parseInt(val);
            return isNaN(num) ? null : num;
        };

        const dbPayload = {
            fecha_pedido: orderData.fechaPedido,
            numero_pedido_sap: sanitize(orderData.numeroPedidoSAP),
            numero_pedido_sicop: sanitize(orderData.numeroPedidoSICOP),
            cantidad_medicamento: parseInt(orderData.cantidadMedicamento) || 0,
            monto: parseFloat(orderData.monto) || 0,
            pur: sanitize(orderData.pur),
            numero_reserva: sanitize(orderData.numeroReserva),
            descripcion: sanitize(orderData.descripcion),
            // Restore item linkage
            item_id: sanitizeBigInt(orderData.medicamentoId),
            medicamento_nombre: sanitize(orderData.medicamentoNombre),
            medicamento_codigo: sanitize(orderData.medicamentoCodigo)
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
    }
};