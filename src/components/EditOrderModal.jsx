import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle } from 'lucide-react';
import { ContractService } from '../services/ContractService';

export function EditOrderModal({ isOpen, onClose, order, onSave }) {
    const [formData, setFormData] = useState({
        fechaPedido: '',
        numeroPedidoSAP: '',
        numeroPedidoSICOP: '',
        cantidadMedicamento: '',
        monto: '',
        numeroReserva: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (order) {
            setFormData({
                fechaPedido: order.fechaPedido || order.fecha || '',
                numeroPedidoSAP: order.numeroPedidoSAP || '',
                numeroPedidoSICOP: order.numeroPedidoSICOP || '',
                cantidadMedicamento: order.cantidadMedicamento || '',
                monto: order.monto || '',
                numeroReserva: order.numeroReserva || ''
            });
        }
    }, [order]);

    console.log("Modal render, isOpen:", isOpen);

    if (!isOpen) return null;

    alert("Debug: EL MODAL SE ESTÁ RENDERIZANDO (Paso 2)");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await ContractService.updateOrder(order.id, {
                ...order, // Keep existing fields
                ...formData,
                monto: parseFloat(formData.monto),
                cantidadMedicamento: parseInt(formData.cantidadMedicamento)
            });
            onSave();
            onClose();
        } catch (err) {
            console.error("Error updating order:", err);
            setError("Error al actualizar el pedido. Por favor intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border-4 border-red-500 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-border/50">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Editar Pedido (DEBUG MODE)
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Fecha del Pedido</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={formData.fechaPedido ? formData.fechaPedido.split('T')[0] : ''}
                                onChange={(e) => setFormData({ ...formData, fechaPedido: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Monto</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-muted/30 border border-input rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    value={formData.monto}
                                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Ref. SAP</label>
                            <input
                                type="text"
                                className="w-full bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={formData.numeroPedidoSAP}
                                onChange={(e) => setFormData({ ...formData, numeroPedidoSAP: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Ref. SICOP</label>
                            <input
                                type="text"
                                className="w-full bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={formData.numeroPedidoSICOP}
                                onChange={(e) => setFormData({ ...formData, numeroPedidoSICOP: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Cantidad</label>
                            <input
                                type="number"
                                className="w-full bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={formData.cantidadMedicamento}
                                onChange={(e) => setFormData({ ...formData, cantidadMedicamento: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">N° Reserva</label>
                            <input
                                type="text"
                                className="w-full bg-muted/30 border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={formData.numeroReserva}
                                onChange={(e) => setFormData({ ...formData, numeroReserva: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
