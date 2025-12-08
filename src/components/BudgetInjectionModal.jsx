import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Check, AlertCircle } from 'lucide-react';

export function BudgetInjectionModal({ onClose, onSubmit, contractCode }) {
    const [fileName, setFileName] = useState('');
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        oficio: ''
    });
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            setFileName(e.target.files[0].name);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate upload delay
        await new Promise(r => setTimeout(r, 600));

        onSubmit({
            amount: parseFloat(formData.amount),
            date: formData.date,
            oficioNumber: formData.oficio,
            pdfName: fileName || 'oficio_inyeccion.pdf'
        });
        setLoading(false);
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-2xl p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                    <h3 className="text-xl font-bold">Inyectar Presupuesto</h3>
                    <p className="text-sm text-muted-foreground">Contrato {contractCode}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* File Upload Simulation */}
                    <div className="border-2 border-dashed border-border rounded-lg p-6 bg-muted/20 hover:bg-muted/40 transition-colors text-center cursor-pointer relative group">
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center gap-2">
                            {fileName ? (
                                <>
                                    <FileText className="w-8 h-8 text-primary" />
                                    <span className="text-sm font-medium text-foreground">{fileName}</span>
                                    <span className="text-xs text-green-500 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Listo para cargar
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="text-sm font-medium text-foreground">Click para subir PDF</span>
                                    <span className="text-xs text-muted-foreground">Oficio de autorización</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Fecha</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">No. Oficio</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej. OF-2023-001"
                                value={formData.oficio}
                                onChange={e => setFormData({ ...formData, oficio: e.target.value })}
                                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Monto a Inyectar</label>
                        <input
                            type="number"
                            required
                            min="1"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Este monto se sumará al disponible actual.
                        </p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 btn btn-ghost border border-border"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !fileName}
                            className="flex-1 btn btn-primary"
                        >
                            {loading ? 'Procesando...' : 'Aplicar Inyección'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
