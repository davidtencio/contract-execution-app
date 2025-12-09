import { useState, useEffect } from 'react';
import { ContractService } from '../services/ContractService';
import { Search, Download, FileText } from 'lucide-react';

export function OrderHistory() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await ContractService.getAllOrdersWithDetails();
            setOrders(data);
        } catch (error) {
            console.error("Error loading orders:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.')) {
            try {
                await ContractService.deleteOrder(id);
                // Optimistic update or reload
                setOrders(currentOrders => currentOrders.filter(o => o.id !== id));
            } catch (error) {
                console.error("Error deleting order:", error);
                alert("Error al eliminar el pedido. Por favor intente nuevamente.");
            }
        }
    };

    const filteredOrders = orders.filter(order => {
        const term = searchTerm.toLowerCase();
        return (
            order.contractCode.toLowerCase().includes(term) ||
            order.contractName.toLowerCase().includes(term) ||
            order.supplierName.toLowerCase().includes(term) ||
            (order.numeroPedidoSAP && order.numeroPedidoSAP.toString().includes(term)) ||
            (order.numeroPedidoSICOP && order.numeroPedidoSICOP.toString().includes(term))
        );
    }).sort((a, b) => {
        const dateA = new Date(a.fechaPedido || a.fecha);
        const dateB = new Date(b.fechaPedido || b.fecha);
        return dateB - dateA;
    });

    const camelCaseToTitle = (text) => {
        const result = text.replace(/([A-Z])/g, " $1");
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    const exportToCSV = () => {
        const headers = ["Fecha", "Concurso", "N° Contrato", "Periodo", "Código Contrato", "Nombre Contrato", "Medicamento", "Proveedor", "Referencia SAP", "Referencia SICOP", "PUR", "N° Reserva", "Monto", "Moneda"];

        let csvContent = headers.join(',') + '\n';

        filteredOrders.forEach(o => {
            const esc = (field) => {
                if (field === null || field === undefined) return '';
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return `"${stringField.replace(/"/g, '""')}"`;
                }
                return stringField;
            };

            const row = [
                (o.fechaPedido || o.fecha || '').split('T')[0],
                o.contractTenderNumber || '-',
                o.contractLegalNumber || '-',
                o.periodName || '-',
                o.contractCode,
                o.contractName,
                o.medicamentoNombre || '-', // Ensure medication check
                o.supplierName,
                o.numeroPedidoSAP || '-',
                o.numeroPedidoSICOP || '-',
                o.pur || '-',
                o.numeroReserva || '-',
                o.monto,
                o.contractCurrency || 'CRC'
            ];

            csvContent += row.map(esc).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_pedidos_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Historial Global de Pedidos
                    </h2>
                    <div className="flex gap-4">
                        <button
                            onClick={exportToCSV}
                            className="btn btn-ghost border border-border hover:bg-muted"
                        >
                            <Download className="w-4 h-4" />
                            Exportar CSV
                        </button>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-4 mb-6 bg-muted/30 p-2 rounded-lg border border-border/50">
                        <Search className="w-5 h-5 text-muted-foreground ml-2" />
                        <input
                            type="text"
                            placeholder="Buscar por contrato, medicamento, proveedor o número de pedido..."
                            className="bg-transparent border-none focus:ring-0 text-lg w-full placeholder:text-muted-foreground/50 h-auto py-2"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-center">Fecha</th>
                                    <th className="px-4 py-3 text-center">Concurso</th>
                                    <th className="px-4 py-3 text-center">N° Contrato</th>
                                    <th className="px-4 py-3 text-center">Periodo</th>
                                    <th className="px-4 py-3 text-center">Cód. Interno</th>
                                    <th className="px-4 py-3 text-center">Medicamento</th>
                                    <th className="px-4 py-3 text-center">Proveedor</th>
                                    <th className="px-4 py-3 text-center">Ref. SAP / SICOP</th>
                                    <th className="px-4 py-3 text-center">Monto</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-muted-foreground text-center">
                                            {(order.fechaPedido || order.fecha || '').split('T')[0].split('-').reverse().join('/')}
                                        </td>
                                        <td className="px-4 py-3 text-center text-muted-foreground">
                                            {order.contractTenderNumber}
                                        </td>
                                        <td className="px-4 py-3 text-center text-muted-foreground">
                                            {order.contractLegalNumber}
                                        </td>
                                        <td className="px-4 py-3 text-center text-muted-foreground">
                                            {order.periodName}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-primary text-center">
                                            {order.contractCode}
                                        </td>
                                        <td className="px-4 py-3 text-foreground/80 text-center">
                                            {order.contractName}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-center">
                                            {order.supplierName}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                {order.numeroPedidoSAP && (
                                                    <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                                                        SAP: {order.numeroPedidoSAP}
                                                    </span>
                                                )}
                                                {order.numeroPedidoSICOP && (
                                                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                                                        SICOP: {order.numeroPedidoSICOP}
                                                    </span>
                                                )}
                                                {!order.numeroPedidoSAP && !order.numeroPedidoSICOP && (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono">
                                            <span className="text-muted-foreground mr-1">
                                                {order.contractCurrency === 'USD' ? '$' : '₡'}
                                            </span>
                                            {parseFloat(order.monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(order.id);
                                                }}
                                                className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 px-4 py-1.5 rounded-full flex items-center justify-center transition-all shadow-sm hover:shadow active:scale-95 mx-auto"
                                                title="Eliminar pedido"
                                            >
                                                <span className="text-xs font-semibold">Eliminar</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan="10" className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-3">
                                                <FileText className="w-12 h-12 opacity-20" />
                                                <p>No se encontraron pedidos.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground text-center">
                        Mostrando {filteredOrders.length} transacciones
                    </div>
                </div>
            </div>


        </>
    );
}
