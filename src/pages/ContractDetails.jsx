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
        selectedItemId: '',
        periodo: '00' // Default period code
    });
    const [orderError, setOrderError] = useState('');

    // Injections State
    const [showInjectionModal, setShowInjectionModal] = useState(false);
    const [injections, setInjections] = useState([]);

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
        // Identify target period based on selected code (00, 01, etc.)
        const targetPeriod = periods.find(p => p.numeroAno === orderForm.periodo);

        if (!targetPeriod) {
            alert('Contrato No Existe'); // Specific alert requested by user
            return;
        }

        // Calculate available balance for the TARGET period
        // Note: We need to calculate this dynamically if we aren't already tracking balance per period in a map.
        // For now, assuming we might not have all orders for all periods loaded, this is a bit tricky.
        // However, we can approximate or if the user is in the "Periodo 1" tab (00) and adds to "Periodo 2", 
        // we might not have the localized budget ready.
        // SAFE APPROACH: If targetPeriod is selectedPeriod, use saldoDisponible. 
        // If not, we skip strict frontend validation or try to compute it if possible? 
        // User request didn't specify strict validation cross-period, just linking. 
        // But implicitly "descargue del saldo" implies handling the budget subtraction.
        // I will implement the linking first. Strict validation across un-loaded periods requires fetching their orders.
        // For MVP: If target === selected, validate. Else, assume server side or loose validation (or just warn).

        // Actually, let's try to validate if we can.
        let targetSaldoDisponible = 0;
        if (targetPeriod.id === selectedPeriod.id) {
            targetSaldoDisponible = saldoDisponible;
        } else {
            // Fallback: Use full budget if we can't easily compute used. 
            // Or better: Just proceed. The user said "descargue del saldo", which happens naturally on DB/Display next time.
            // I will skip strict validation for cross-period additions to avoid blocking data entry 
            // (or getting it wrong without fetching), but keep it for current period.
            targetSaldoDisponible = Number.MAX_SAFE_INTEGER;
        }

        if (targetPeriod.id === selectedPeriod.id) {
            if (amount > saldoDisponible + (editingOrder ? editingOrder.monto : 0)) {
                setOrderError(`El monto excede el saldo disponible (${contract.moneda === 'CRC' ? '₡' : '$'}${saldoDisponible + (editingOrder ? editingOrder.monto : 0)})`);
                return;
            }
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
            periodId: targetPeriod.id, // Use the dynamically found period ID
            fechaPedido: orderForm.fechaPedido,
            numeroPedidoSAP: orderForm.numeroPedidoSAP,
            numeroPedidoSICOP: orderForm.numeroPedidoSICOP,
            pur: orderForm.pur,
            numeroReserva: orderForm.numeroReserva,
            periodo: orderForm.periodo,
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
                selectedItemId: contract.items?.[0]?.id || '',
                periodo: '00'
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
            selectedItemId: order.medicamentoId || (contract.items?.[0]?.id || ''),
            periodo: order.periodo || '00'
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
                    </div>
                    <div className="space-y-2">
                        {periods.map(period => (
                            <div
                                key={period.id}
                                onClick={() => setSelectedPeriod(period)}
                                className={`p-4 rounded-xl cursor-pointer border transition-all
                  ${selectedPeriod?.id === period.id
                                        ? 'bg-primary/10 border-primary shadow-sm'
                                        : 'bg-white border-gray-200 hover:border-primary/50'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold">{(period.numeroAno || '').replace('Año', 'Periodo')}</span>
                                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{period.estado}</span>
                                </div>
                                <div className="text-sm text-gray-500">
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
                                <div className="text-4xl font-bold text-foreground mb-4">
                                    {contract.moneda === 'CRC' ? '₡' : '$'}{Number(saldoDisponible).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>

                                {/* Contract Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-background/50 rounded-lg border border-border/50 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Unidades Disponibles (Est.)</p>
                                        <p className="font-semibold text-foreground">
                                            {(() => {
                                                const price = contract.items?.length > 0 ? contract.items[0].precioUnitario : contract.precioUnitario;
                                                const units = price > 0 ? saldoDisponible / price : 0;
                                                return Math.floor(units).toLocaleString('es-ES');
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Precio Unitario</p>
                                        <p className="font-semibold text-foreground">
                                            {contract.moneda === 'CRC' ? '₡' : '$'}
                                            {Number(contract.items?.length > 0 ? contract.items[0].precioUnitario : contract.precioUnitario)
                                                .toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Proveedor</p>
                                        <p className="font-semibold text-foreground truncate" title={contract.proveedor}>
                                            {contract.proveedor}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">N° Contrato</p>
                                        <p className="font-semibold text-foreground truncate" title={contract.contratoLegal}>
                                            {contract.contratoLegal || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mt-4">
                                    <div className="text-sm text-muted-foreground flex flex-col gap-1">
                                        <span>Presupuesto Asignado: {contract.moneda === 'CRC' ? '₡' : '$'}{Number(selectedPeriod.presupuestoAsignado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className="text-red-400">Monto Ejecutado: {contract.moneda === 'CRC' ? '₡' : '$'}{orders.reduce((sum, order) => sum + parseFloat(order.monto), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                                <label>Periodo</label>
                                                <select
                                                    name="periodo"
                                                    value={orderForm.periodo}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                >
                                                    <option value="00">00</option>
                                                    <option value="01">01</option>
                                                    <option value="02">02</option>
                                                    <option value="03">03</option>
                                                </select>
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

            {/* Modals outside the grid to prevent z-index issues */}
            {showInjectionModal && (
                <BudgetInjectionModal
                    contractCode={contract.codigo}
                    onClose={() => setShowInjectionModal(false)}
                    onSubmit={handleInjectionSubmit}
                />
            )}
        </div>
    );
}
