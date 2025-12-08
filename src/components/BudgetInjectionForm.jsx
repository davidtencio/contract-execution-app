import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Check, AlertCircle } from 'lucide-react';

export function BudgetInjectionForm({ contractCode, initialCurrency = 'CRC', initialData = null, onSubmit, onCancel }) {
    const [fileName, setFileName] = useState('');
    const [formData, setFormData] = useState({
        amount: '',
        currency: initialCurrency,
        date: new Date().toISOString().split('T')[0],
        oficio: ''
    });

    // Populate form on initialData change
    useEffect(() => {
        if (initialData) {
            setFormData({
                amount: initialData.amount, // assuming simple number, formatting handled in render
                currency: initialData.currency || initialCurrency,
                date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                oficio: initialData.oficioNumber || ''
            });
            if (initialData.pdfName) {
                setFileName(initialData.pdfName);
            }
            if (initialData.fileData) {
                setFileData(initialData.fileData);
            }
        }
    }, [initialData, initialCurrency]);

    const fileInputRef = useRef(null);
    // ... rest of state ...
    const [loading, setLoading] = useState(false);
    const [fileData, setFileData] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) {
                alert('El archivo excede el límite de 500KB.');
                e.target.value = ''; // Reset input
                return;
            }
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (evt) => {
                setFileData(evt.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Safety check
        if (!fileData && !initialData?.fileData) {
            alert('Error: No se ha procesado el archivo PDF. Intente seleccionarlo nuevamente.');
            return;
        }

        setLoading(true);
        // Simulate upload delay
        await new Promise(r => setTimeout(r, 600));

        try {
            onSubmit({
                amount: parseFloat(formData.amount.toString().replace(/,/g, '')),
                currency: formData.currency,
                date: formData.date,
                oficioNumber: formData.oficio,
                pdfName: fileName || 'oficio_inyeccion.pdf',
                fileData: fileData || initialData?.fileData // Use new file or keep existing
            });

            // Only reset if NOT editing (and successful)
            if (!initialData) {
                setFileName('');
                setFileData(null);
                setFormData({
                    amount: '',
                    date: new Date().toISOString().split('T')[0],
                    oficio: ''
                });
            }
        } catch (error) {
            console.error(error);
            alert(error.message || 'Error al guardar la inyección.');
            // Do NOT reset form, keep modal open
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card bg-card border border-border shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6">
                <h3 className="text-xl font-bold">{initialData ? 'Editar Inyección' : 'Nueva Inyección'}</h3>
                <p className="text-sm text-muted-foreground">Registrando adición para contrato <span className="font-medium text-foreground">{contractCode}</span></p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Fecha</label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
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
                            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Monto a Inyectar</label>
                    <div className="flex gap-3">
                        <select
                            value={formData.currency}
                            onChange={e => setFormData({ ...formData, currency: e.target.value })}
                            className="w-24 bg-background border border-input rounded-md px-2 py-2 text-sm focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                            <option value="CRC">CRC</option>
                            <option value="USD">USD</option>
                        </select>
                        <div className="w-48 relative">
                            <input
                                type="text"
                                required
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={e => {
                                    // Remove non-numeric chars except dot
                                    const value = e.target.value.replace(/[^0-9.]/g, '');
                                    // Prevent multiple dots
                                    if ((value.match(/\./g) || []).length > 1) return;

                                    // Format with commas
                                    const parts = value.split('.');
                                    const formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                                        (parts.length > 1 ? '.' + parts[1] : '');

                                    setFormData({ ...formData, amount: formatted });
                                }}
                                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Este monto se sumará al disponible actual.
                    </p>
                </div>

                {/* File Upload Simulation */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Documento de Respaldo</label>
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current.click()}
                            className="btn btn-secondary border border-border hover:bg-muted transition-colors flex items-center gap-2 px-4 py-2 rounded-md"
                        >
                            <Upload className="w-4 h-4" />
                            {fileName ? 'Cambiar Archivo' : 'Seleccionar PDF'}
                        </button>
                        {fileName && (
                            <span className="text-sm text-foreground flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                {fileName}
                            </span>
                        )}
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 btn btn-ghost border border-border"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading || !fileName || !fileData}
                        className="flex-1 btn btn-primary shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Procesando...' : (initialData ? 'Guardar Cambios' : 'Aplicar Inyección')}
                    </button>
                </div>
            </form>
        </div>
    );
}
