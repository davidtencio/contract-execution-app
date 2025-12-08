
import { useState, useEffect } from 'react';
import { ContractService } from '../services/ContractService';
import { useMemo } from 'react';
import { ArrowLeft, Plus, AlertTriangle, DollarSign, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { BudgetInjectionModal } from '../components/BudgetInjectionModal';

export function ContractDetails({ contractId, onBack }) {
    const [contract, setContract] = useState(null);
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    // Order Form State
    const [showOrderForm, setShowOrderForm] = useState(false);
    const [orderForm, setOrderForm] = useState({
        fechaPedido: '',
        numeroPedidoSAP: '',
        numeroPedidoSICOP: '',
        pur: '',
        numeroReserva: '',
        cantidadMedicamento: '',
        monto: '',
        selectedItemId: ''
    });
    const [orderError, setOrderError] = useState('');

    // Injections State
    const [showInjectionModal, setShowInjectionModal] = useState(false);
    const [injections, setInjections] = useState([]);

    // Period Modal State
    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [newPeriodData, setNewPeriodData] = useState({
        presupuesto: '',
        durationYears: '1'
    });

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadContractData = async () => {
            if (!contractId) return;
            try {
                setLoading(true);
                const c = await ContractService.getContractById(contractId);
                const p = await ContractService.getPeriodsByContractId(contractId);
                setContract(c);
                setPeriods(p);
                if (p.length > 0) {
                    setSelectedPeriod(p[0]);
                }
                if (c?.items?.length > 0) {
                    setOrderForm(prev => ({ ...prev, selectedItemId: 0 }));
                }
            } catch (err) {
                console.error("Error loading contract:", err);
            } finally {
                setLoading(false);
            }
        };
        loadContractData();
    }, [contractId]);

    // Update orders when period changes
    useEffect(() => {
        const loadPeriodData = async () => {
            if (selectedPeriod) {
                try {
                    // setLoading(true); // Optional: individual loading state for tab switch
                    const ordersDetails = await ContractService.getOrdersByPeriodId(selectedPeriod.id);
                    const injectionDetails = await ContractService.getInjectionsByPeriodId(selectedPeriod.id);
                    setOrders(ordersDetails);
                    setInjections(injectionDetails);
                } catch (err) {
                    console.error("Error loading period data:", err);
                }
            }
        };
        loadPeriodData();
    }, [selectedPeriod]);

    const saldoDisponible = useMemo(() => {
        if (!selectedPeriod) return 0;
        const totalOrders = orders.reduce((sum, order) => sum + parseFloat(order.monto), 0);
        const totalInjections = injections.reduce((sum, inj) => sum + parseFloat(inj.amount), 0);
        return (parseFloat(selectedPeriod.presupuestoAsignado) + totalInjections) - totalOrders;
    }, [selectedPeriod, orders, injections]);

    const handleInjectionSubmit = async (data) => {
        try {
            await ContractService.addBudgetInjection({
                contractId: contract.id,
                periodId: selectedPeriod.id,
                ...data
            });
            const updatedInjections = await ContractService.getInjectionsByPeriodId(selectedPeriod.id);
            setInjections(updatedInjections);
            setShowInjectionModal(false);
            alert('Presupuesto inyectado correctamente');
        } catch (error) {
            console.error(error);
            alert('Error al inyectar presupuesto');
        }
    };

    const handleAddPeriod = async () => {
        if (!newPeriodData.presupuesto) return alert("Ingrese el presupuesto");

        try {
            // Calculate dates based on last period or contract start
            let startDate = new Date(contract.fechaInicio); // Default
            if (periods.length > 0) {
                // Start next day after last period ends
                // Sort to find actual last one
                const lastPeriod = [...periods].sort((a, b) => new Date(b.fechaFin) - new Date(a.fechaFin))[0];
                startDate = new Date(lastPeriod.fechaFin);
                startDate.setDate(startDate.getDate() + 1); // Next day
            }

            const endDate = new Date(startDate);
            endDate.setFullYear(startDate.getFullYear() + parseInt(newPeriodData.durationYears));

            const periodName = `Periodo ${periods.length + 1}`; // Simple increment naming

            const newPeriod = await ContractService.createPeriod({
                contractId: contract.id,
                nombre: periodName,
                fechaInicio: startDate.toISOString(),
                fechaFin: endDate.toISOString(),
                presupuestoAsignado: parseFloat(newPeriodData.presupuesto.replace(/,/g, '')),
                estado: 'Pendiente'
            });

            setPeriods(prev => [...prev, {
                id: newPeriod.id,
                contractId: newPeriod.contract_id,
                numeroAno: newPeriod.nombre,
                fechaInicio: newPeriod.fecha_inicio,
                fechaFin: newPeriod.fecha_fin,
                presupuestoAsignado: newPeriod.presupuesto_asignado,
                presupuestoInicial: newPeriod.presupuesto_inicial,
                estado: newPeriod.estado,
                moneda: newPeriod.moneda
            }]);

            setShowPeriodModal(false);
            setNewPeriodData({ presupuesto: '', durationYears: '1' });
            alert("Periodo agregado exitosamente");
        } catch (e) {
            console.error(e);
            alert("Error al crear periodo");
        }
    };

    const [editingOrder, setEditingOrder] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setOrderForm(prev => {
            const updates = { [name]: value };

            // Recalculate amount if quantity or item changes
            let quantity = parseFloat(name === 'cantidadMedicamento' ? value : prev.cantidadMedicamento);
            let itemId = name === 'selectedItemId' ? value : prev.selectedItemId;

            if (!isNaN(quantity)) {
                let unitPrice = contract.precioUnitario;

                // If we have items and a selection, find specific price
                if (contract.items?.length > 0) {
                    // Use index lookup which is robust against duplicate IDs
                    const index = parseInt(itemId);
                    const selectedItem = !isNaN(index) && contract.items[index] ? contract.items[index] : contract.items[0];
                    if (selectedItem) {
                        unitPrice = selectedItem.precioUnitario;
                    }
                }

                updates.monto = (quantity * unitPrice).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            } else if (name === 'cantidadMedicamento' && value === '') {
                updates.monto = '';
            }

            return {
                ...prev,
                ...updates
            };
        });
    };

    const handleAddOrder = async () => {
        // Sanitize amount string (remove commas) before parsing
        const rawAmount = orderForm.monto.toString().replace(/,/g, '');
        const amount = parseFloat(rawAmount);
        if (!amount) return;

        // Skip excessive validation if editing same amount (simplification) or just validate always
        if (amount > saldoDisponible + (editingOrder ? editingOrder.monto : 0)) {
            setOrderError(`El monto excede el saldo disponible (${contract.moneda === 'CRC' ? '₡' : '$'}${saldoDisponible + (editingOrder ? editingOrder.monto : 0)})`);
            return;
        }

        // Identify selected item details
        let itemDetails = {};
        if (contract.items?.length > 0) {
            const index = parseInt(orderForm.selectedItemId);
            const selectedItem = (!isNaN(index) && contract.items[index]) ? contract.items[index] : contract.items[0];
            itemDetails = {
                medicamentoId: selectedItem.id,
                medicamentoCodigo: selectedItem.codigo,
                medicamentoNombre: selectedItem.nombre
            };
        }

        const orderData = {
            contractId: contract.id,
            periodId: selectedPeriod.id,
            fechaPedido: orderForm.fechaPedido,
            numeroPedidoSAP: orderForm.numeroPedidoSAP,
            numeroPedidoSICOP: orderForm.numeroPedidoSICOP,
            pur: orderForm.pur,
            numeroReserva: orderForm.numeroReserva,
            cantidadMedicamento: orderForm.cantidadMedicamento,
            monto: amount,
            descripcion: `SAP: ${orderForm.numeroPedidoSAP}`,
            ...itemDetails
        };

        try {
            if (editingOrder) {
                await ContractService.updateOrder(editingOrder.id, orderData);
                alert('Pedido actualizado exitosamente');
            } else {
                await ContractService.createOrder(orderData);
                alert('Pedido creado exitosamente');
            }

            // Refresh
            const refreshedOrders = await ContractService.getOrdersByPeriodId(selectedPeriod.id);
            setOrders(refreshedOrders);

            setShowOrderForm(false);
            setOrderForm({
                fechaPedido: '',
                numeroPedidoSAP: '',
                numeroPedidoSICOP: '',
                pur: '',
                numeroReserva: '',
                cantidadMedicamento: '',
                monto: '',
                selectedItemId: contract.items?.[0]?.id || ''
            });
            setOrderError('');
            setEditingOrder(null);
        } catch (err) {
            console.error(err);
            alert(`Error al procesar el pedido: ${err.message || 'Revise la consola.'}`);
        }
    };

    const handleEditOrder = (order) => {
        setEditingOrder(order);
        setOrderForm({
            fechaPedido: order.fechaPedido || order.fecha?.split('T')[0] || '',
            numeroPedidoSAP: order.numeroPedidoSAP || '',
            numeroPedidoSICOP: order.numeroPedidoSICOP || '',
            pur: order.pur || '',
            numeroReserva: order.numeroReserva || '',
            cantidadMedicamento: order.cantidadMedicamento || '',
            monto: order.monto.toString(),
            selectedItemId: order.medicamentoId || (contract.items?.[0]?.id || '')
        });
        setShowOrderForm(true);
    };

    const handleDeleteOrder = async (orderId) => {
        if (window.confirm('¿Eliminar este pedido permanentemente?')) {
            try {
                await ContractService.deleteOrder(orderId);
                const refreshedOrders = await ContractService.getOrdersByPeriodId(selectedPeriod.id);
                setOrders(refreshedOrders);
            } catch (err) {
                console.error(err);
                alert("Error al eliminar");
            }
        }
    };

    if (!contract) return <div>Cargando...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="btn btn-ghost p-2 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex flex-col gap-1">
                        {contract.items?.length > 0 ? (
                            contract.items.map((item, idx) => (
                                <h1 key={idx} className="text-2xl font-bold">
                                    {item.codigo} - {item.nombre}
                                </h1>
                            ))
                        ) : (
                            <h1 className="text-2xl font-bold">{contract.codigo} - {contract.nombre}</h1>
                        )}
                    </div>
                    <div className="flex gap-4 text-muted-foreground text-sm">
                        <span>Proveedor: {contract.proveedor}</span>
                        <span>•</span>
                        <span>Concurso: {contract.concurso || 'N/A'}</span>
                    </div>
                </div>
                <div className="ml-auto">
                    <span className="badge badge-active text-sm">Activo</span>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Periods List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Periodos</h3>
                        <button
                            onClick={() => setShowPeriodModal(true)}
                            className="btn btn-xs btn-outline border-primary/20 text-primary hover:bg-primary/10 gap-1"
                        >
                            <Plus className="w-3 h-3" /> Nuevo
                        </button>
                    </div>
                    <div className="space-y-2">
                        {periods.map(period => (
                            <div
                                key={period.id}
                                onClick={() => setSelectedPeriod(period)}
                                className={`p-4 rounded-xl cursor-pointer border transition-all
                  ${selectedPeriod?.id === period.id
                                        ? 'bg-primary/10 border-primary shadow-sm'
                                        : 'bg-card border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold">{(period.numeroAno || '').replace('Año', 'Periodo')}</span>
                                    <span className="text-xs bg-background/50 px-2 py-0.5 rounded-full">{period.estado}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {new Date(period.fechaInicio).toLocaleDateString()} - {new Date(period.fechaFin).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Period Details & Budget */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedPeriod && (
                        <>
                            {/* Saldo Card */}
                            <div className="card bg-gradient-to-r from-card to-primary/5 relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-primary" />
                                        <h3 className="font-semibold">Saldo Disponible</h3>
                                    </div>
                                    <button
                                        onClick={() => setShowInjectionModal(true)}
                                        className="btn btn-outline btn-xs text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/50 gap-2 transition-all"
                                    >
                                        <TrendingUp className="w-3 h-3" />
                                        Inyectar Presupuesto
                                    </button>
                                </div>
                                <div className="text-4xl font-bold text-foreground mb-1">
                                    {contract.moneda === 'CRC' ? '₡' : '$'}{Number(saldoDisponible).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-sm text-muted-foreground">
                                        Presupuesto Asignado: {contract.moneda === 'CRC' ? '₡' : '$'}{Number(selectedPeriod.presupuestoAsignado).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    {injections.length > 0 && (
                                        <div className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            +{contract.moneda === 'CRC' ? '₡' : '$'}{injections.reduce((a, b) => a + parseFloat(b.amount), 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions Area */}
                            <div className="card">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold">Pedidos del Periodo</h3>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => {
                                            setEditingOrder(null);
                                            setOrderForm({
                                                fechaPedido: new Date().toISOString().split('T')[0],
                                                numeroPedidoSAP: '',
                                                numeroPedidoSICOP: '',
                                                cantidadMedicamento: '',
                                                monto: ''
                                            });
                                            setShowOrderForm(!showOrderForm);
                                        }}
                                    >
                                        <Plus className="w-4 h-4" /> Nuevo Pedido
                                    </button>
                                </div>

                                {showOrderForm && (
                                    <div className="mb-6 p-6 border border-border rounded-xl bg-card shadow-lg animate-in slide-in-from-top-2">
                                        <h4 className="font-medium mb-4 text-lg border-b border-border pb-2">
                                            {editingOrder ? 'Editar Pedido' : 'Registrar Nuevo Pedido'}
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="input-group">
                                                <label>Fecha del Pedido</label>
                                                <input
                                                    type="date"
                                                    name="fechaPedido"
                                                    value={orderForm.fechaPedido}
                                                    onChange={handleInputChange}
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label>No. Pedido SAP</label>
                                                <input
                                                    type="text"
                                                    name="numeroPedidoSAP"
                                                    value={orderForm.numeroPedidoSAP}
                                                    onChange={handleInputChange}
                                                    placeholder="Ej. 900000"
                                                />
                                            </div>

                                            {contract.items?.length > 1 && (
                                                <div className="input-group md:col-span-2">
                                                    <label>Medicamento a Solicitar</label>
                                                    <select
                                                        name="selectedItemId"
                                                        value={orderForm.selectedItemId}
                                                        onChange={handleInputChange}
                                                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    >
                                                        {contract.items.map((item, idx) => (
                                                            <option key={idx} value={idx}>
                                                                {item.codigo} - {item.nombre} ({item.moneda === 'CRC' ? '₡' : '$'}{item.precioUnitario.toLocaleString('en-US')})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="input-group">
                                                <label>No. Pedido SICOP</label>
                                                <input
                                                    type="text"
                                                    name="numeroPedidoSICOP"
                                                    value={orderForm.numeroPedidoSICOP}
                                                    onChange={handleInputChange}
                                                    placeholder="Ej. 82202"
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label>PUR</label>
                                                <input
                                                    type="text"
                                                    name="pur"
                                                    value={orderForm.pur}
                                                    onChange={handleInputChange}
                                                    placeholder="Ej. PUR-2025"
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label>N° Reserva</label>
                                                <input
                                                    type="text"
                                                    name="numeroReserva"
                                                    value={orderForm.numeroReserva}
                                                    onChange={handleInputChange}
                                                    placeholder="Ej. 1000256"
                                                />
                                            </div>

                                            <div className="input-group">
                                                <label>Cantidad de Medicamento</label>
                                                <input
                                                    type="number"
                                                    name="cantidadMedicamento"
                                                    value={orderForm.cantidadMedicamento}
                                                    onChange={handleInputChange}
                                                    placeholder="Unidades"
                                                />
                                            </div>

                                            <div className="input-group md:col-span-2">
                                                <label>Monto Total ({contract.moneda === 'CRC' ? '₡' : '$'})</label>
                                                <input
                                                    type="text"
                                                    name="monto"
                                                    value={orderForm.monto}
                                                    onChange={handleInputChange}
                                                    className={orderError ? 'border-red-500' : ''}
                                                    placeholder="0.00"
                                                />
                                                {orderError && (
                                                    <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {orderError}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-3 justify-end mt-6">
                                            <button
                                                className="btn btn-ghost"
                                                onClick={() => {
                                                    setEditingOrder(null);
                                                    setShowOrderForm(false);
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleAddOrder}
                                            >
                                                {editingOrder ? 'Actualizar Pedido' : 'Crear Pedido'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Orders List */}
                                <div className="space-y-3">
                                    {orders.map(order => (
                                        <div key={order.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group shadow-sm">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-bold text-foreground">SAP: {order.numeroPedidoSAP || 'N/A'}</span>
                                                    {order.numeroPedidoSICOP && (
                                                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">SICOP: {order.numeroPedidoSICOP}</span>
                                                    )}
                                                </div>
                                                {order.medicamentoNombre && (
                                                    <div className="text-sm font-medium text-foreground/80 mb-1">
                                                        {order.medicamentoCodigo} - {order.medicamentoNombre}
                                                    </div>
                                                )}
                                                <div className="text-sm text-muted-foreground flex gap-4">
                                                    <span>Fecha: {(order.fechaPedido || order.fecha || '').split('T')[0].split('-').reverse().join('/')}</span>
                                                    {order.cantidadMedicamento && <span>Cant: {order.cantidadMedicamento}</span>}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6 mt-2 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                                                <div className="font-mono font-bold text-lg text-red-400">
                                                    - {contract.moneda === 'CRC' ? '₡' : '$'}{parseFloat(order.monto).toLocaleString('en-US')}
                                                </div>

                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditOrder(order)}
                                                        className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {orders.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground border-t border-border/50">
                                            No hay pedidos registrados en este periodo.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {showInjectionModal && (
                <BudgetInjectionModal
                    contractCode={contract.codigo}
                    onClose={() => setShowInjectionModal(false)}
                    onSubmit={handleInjectionSubmit}
                />
            )}


            {showPeriodModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4">Agregar Nuevo Periodo</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Duración</label>
                                    <select
                                        className="w-full bg-background border border-input rounded-md h-10 px-3"
                                        value={newPeriodData.durationYears}
                                        onChange={e => setNewPeriodData({ ...newPeriodData, durationYears: e.target.value })}
                                    >
                                        <option value="1">1 Año</option>
                                        <option value="2">2 Años</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Presupuesto Inicial ({contract.moneda === 'CRC' ? '₡' : '$'})</label>
                                    <input
                                        className="w-full bg-background border border-input rounded-md h-10 px-3"
                                        value={newPeriodData.presupuesto}
                                        onChange={e => {
                                            const val = e.target.value.replace(/,/g, '');
                                            if (!isNaN(val)) setNewPeriodData({ ...newPeriodData, presupuesto: val });
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button className="btn btn-ghost" onClick={() => setShowPeriodModal(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleAddPeriod}>Crear Periodo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
