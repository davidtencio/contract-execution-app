
import { useState, useEffect } from 'react';
import { ContractService } from '../services/ContractService';
import { ChevronRight, Check, AlertCircle, Save, Plus, Trash2 } from 'lucide-react';

export function ContractWizard({ onClose, onSaveSuccess, contractToEdit = null }) {
    const isEditMode = !!contractToEdit;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Form State
    const [formData, setFormData] = useState({
        // Step 1: General (Shared)
        periodId: null, // Store period ID for updates
        proveedor: '',
        concurso: '',
        contratoLegal: '',
        periodName: '', // New Field

        // Items (Medications)
        items: [{
            id: Date.now(),
            codigo: '',
            nombre: '',
            moneda: 'USD',
            precioUnitario: ''
        }],

        // Step 2: Year 1 Config
        fechaInicio: '',
        durationYears: '1', // Default 1 year
        presupuestoInicial: '',
        topeAnual: ''
    });

    // Load data if editing


    useEffect(() => {
        const loadContractDetails = async () => {
            if (contractToEdit) {
                setLoading(true); // Reusing loading state, or creating a new one? Reusing is fine but might block UI.
                try {
                    // Always fetch fresh data to get items
                    const fullContract = await ContractService.getContractById(contractToEdit.id);

                    // Find relevant period (e.g., first one or specific one)
                    const initialPeriod = fullContract.periods && fullContract.periods.length > 0 ? fullContract.periods[0] : null;

                    setFormData(prev => ({
                        ...prev,
                        proveedor: fullContract.proveedor,
                        concurso: fullContract.concurso || '',
                        contratoLegal: fullContract.contratoLegal || '',
                        periodName: initialPeriod ? initialPeriod.nombre : '',

                        // Load Period Data
                        periodId: initialPeriod ? initialPeriod.id : null,
                        fechaInicio: initialPeriod ? initialPeriod.fechaInicio : '',
                        presupuestoInicial: initialPeriod ? initialPeriod.presupuestoInicial : '',
                        topeAnual: initialPeriod ? initialPeriod.topeAnual : '',
                        durationYears: '1', // Default or derive if needed

                        items: fullContract.items && fullContract.items.length > 0 ? fullContract.items.map(i => ({
                            id: i.id || Date.now() + Math.random(),
                            codigo: i.codigo,
                            nombre: i.nombre,
                            moneda: i.moneda || 'USD',
                            precioUnitario: i.precioUnitario
                        })) : [{
                            id: Date.now(),
                            codigo: fullContract.codigo,
                            nombre: fullContract.nombre,
                            moneda: fullContract.moneda || 'USD',
                            precioUnitario: fullContract.precioUnitario
                        }]
                    }));
                } catch (error) {
                    console.error("Error loading contract details:", error);
                    alert("Error al cargar los detalles del contrato.");
                    onClose();
                } finally {
                    setLoading(false);
                }
            }
        };

        loadContractDetails();
    }, [contractToEdit]);

    const handleItemChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const addItem = () => {
        if (formData.items.length >= 3) return;
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                id: Date.now(),
                codigo: '',
                nombre: '',
                moneda: 'USD',
                precioUnitario: ''
            }]
        }));
    };

    const removeItem = (id) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.proveedor) newErrors.proveedor = 'Requerido';

        formData.items.forEach((item, index) => {
            if (!item.codigo) newErrors[`codigo_${index}`] = 'Requerido';
            if (!item.nombre) newErrors[`nombre_${index}`] = 'Requerido';
            if (!item.precioUnitario) newErrors[`precio_${index}`] = 'Requerido';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};
        if (!formData.fechaInicio) newErrors.fechaInicio = 'Requerido';
        if (!formData.presupuestoInicial) newErrors.presupuestoInicial = 'Requerido';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        }
    };

    const handleSave = async () => {
        if (isEditMode) {
            if (!validateStep1()) return;
        } else {
            if (!validateStep2()) return;
        }

        setLoading(true);
        setTimeout(() => {
            try {
                const contractPayload = {
                    proveedor: formData.proveedor,
                    concurso: formData.concurso,
                    contratoLegal: formData.contratoLegal,
                    items: formData.items.map(i => ({
                        codigo: i.codigo,
                        nombre: i.nombre,
                        moneda: i.moneda,
                        precioUnitario: parseFloat(i.precioUnitario.toString().replace(/,/g, ''))
                    })),
                    // Include Initial Period Data for Updates
                    initialPeriod: isEditMode && formData.periodId ? {
                        id: formData.periodId,
                        fechaInicio: formData.fechaInicio,
                        presupuestoInicial: formData.presupuestoInicial.toString().replace(/,/g, ''),
                        topeAnual: formData.topeAnual ? formData.topeAnual.toString().replace(/,/g, '') : null
                    } : null
                };

                if (isEditMode) {
                    ContractService.updateContract(contractToEdit.id, contractPayload);
                } else {
                    const year1Payload = {
                        nombre: formData.periodName || 'Periodo 1', // Use form value
                        fechaInicio: formData.fechaInicio,
                        presupuestoInicial: parseFloat(formData.presupuestoInicial.toString().replace(/,/g, '')),
                        topeAnual: formData.topeAnual ? parseFloat(formData.topeAnual.toString().replace(/,/g, '')) : parseFloat(formData.presupuestoInicial.toString().replace(/,/g, '')),
                        durationYears: parseInt(formData.durationYears)
                    };
                    ContractService.createContract(contractPayload, year1Payload);
                }

                onSaveSuccess();
                onClose();
            } catch (e) {
                console.error(e);
                alert('Error al guardar contrato');
            } finally {
                setLoading(false);
            }
        }, 800);
    };

    return (
        <div className="card max-w-3xl mx-auto mt-8 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="border-b border-border pb-4 mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    {isEditMode ? 'Editar Contrato' : (
                        <>
                            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                                {step}
                            </div>
                            {step === 1 ? 'Datos del Contrato' : 'Configuración Inicial'}
                        </>
                    )}
                </h2>
                <p className="text-sm text-muted-foreground ml-10 mt-1">
                    {step === 1 ? 'Ingrese proveedor y medicamentos (máx 3).' : 'Defina el presupuesto inicial.'}
                </p>
            </div>

            {/* Form Content */}
            <div className="space-y-6">
                {step === 1 ? (
                    <div className="space-y-6">
                        {/* 1. Items List (Top Priority) */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="font-semibold text-sm text-foreground">Medicamentos ({formData.items.length}/3)</label>
                                {formData.items.length < 3 && (
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="btn btn-sm btn-outline text-primary border-primary/20 hover:bg-primary/10 hover:text-primary hover:border-primary/50 gap-2 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Medicamento
                                    </button>
                                )}
                            </div>

                            {formData.items.map((item, index) => (
                                <div key={item.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors">
                                    {formData.items.length > 1 && (
                                        <div className="flex justify-end mb-2">
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.id)}
                                                className="btn btn-xs btn-ghost text-red-500 hover:bg-red-500/10 hover:text-red-600 gap-1 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Eliminar
                                            </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="input-group">
                                            <label className="text-xs">Código *</label>
                                            <input
                                                value={item.codigo}
                                                onChange={(e) => handleItemChange(item.id, 'codigo', e.target.value)}
                                                className={`h-8 text-sm ${errors[`codigo_${index}`] ? 'border-red-500' : ''}`}
                                                placeholder="MED-..."
                                                autoFocus={index === 0}
                                            />
                                        </div>
                                        <div className="input-group lg:col-span-1">
                                            <label className="text-xs">Nombre *</label>
                                            <input
                                                value={item.nombre}
                                                onChange={(e) => handleItemChange(item.id, 'nombre', e.target.value)}
                                                className={`h-8 text-sm ${errors[`nombre_${index}`] ? 'border-red-500' : ''}`}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="text-xs">Moneda</label>
                                            <select
                                                value={item.moneda}
                                                onChange={(e) => handleItemChange(item.id, 'moneda', e.target.value)}
                                                className="h-8 text-sm py-0"
                                            >
                                                <option value="USD">Dólares (USD)</option>
                                                <option value="CRC">Colones (CRC)</option>
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label className="text-xs">Precio *</label>
                                            <input
                                                type="text"
                                                value={item.precioUnitario}
                                                onChange={(e) => handleItemChange(item.id, 'precioUnitario', e.target.value)}
                                                onFocus={(e) => {
                                                    const val = e.target.value.replace(/,/g, '');
                                                    handleItemChange(item.id, 'precioUnitario', val);
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.target.value.replace(/,/g, '');
                                                    if (val && !isNaN(val)) {
                                                        const formatted = Number(val).toLocaleString('en-US', { maximumFractionDigits: 10 });
                                                        handleItemChange(item.id, 'precioUnitario', formatted);
                                                    }
                                                }}
                                                className={`h-8 text-sm ${errors[`precio_${index}`] ? 'border-red-500' : ''}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 2. Common Fields (Bottom) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border border-border/50">
                            <div className="input-group">
                                <label>Proveedor *</label>
                                <input
                                    name="proveedor"
                                    value={formData.proveedor}
                                    onChange={handleChange}
                                    className={errors.proveedor ? 'border-red-500' : ''}
                                />
                                {errors.proveedor && <span className="text-xs text-red-500">{errors.proveedor}</span>}
                            </div>
                            <div className="input-group">
                                <label>No. Concurso</label>
                                <input
                                    name="concurso"
                                    value={formData.concurso}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="input-group">
                                <label>No. Contrato</label>
                                <input
                                    name="contratoLegal"
                                    value={formData.contratoLegal}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="input-group">
                                <label>Periodo</label>
                                <select
                                    name="periodName"
                                    value={formData.periodName}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">Seleccionar...</option>
                                    <option value="01">01</option>
                                    <option value="02">02</option>
                                    <option value="03">03</option>
                                    <option value="04">04</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 mb-4">
                            <h4 className="font-semibold text-primary text-sm flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Inicializando {formData.periodName || 'Periodo'}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                                El sistema creará automáticamente el primer periodo contractual vinculado a este contrato.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="input-group">
                                <label>Fecha Inicio Ejecución *</label>
                                <input
                                    type="date"
                                    name="fechaInicio"
                                    value={formData.fechaInicio}
                                    onChange={handleChange}
                                    className={errors.fechaInicio ? 'border-red-500' : ''}
                                />
                            </div>

                            <div className="input-group">
                                <label>Duración del Periodo</label>
                                <select
                                    name="durationYears"
                                    value={formData.durationYears}
                                    onChange={handleChange}
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="1">1 Año</option>
                                    <option value="2">2 Años</option>
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Presupuesto Inicial *</label>
                                <input
                                    type="text"
                                    name="presupuestoInicial"
                                    value={formData.presupuestoInicial}
                                    onChange={handleChange}
                                    onFocus={(e) => handleChange({ target: { name: 'presupuestoInicial', value: e.target.value.replace(/,/g, '') } })}
                                    onBlur={(e) => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val && !isNaN(val)) {
                                            const formatted = Number(val).toLocaleString('en-US', { maximumFractionDigits: 10 });
                                            handleChange({ target: { name: 'presupuestoInicial', value: formatted } });
                                        }
                                    }}
                                    className={errors.presupuestoInicial ? 'border-red-500' : ''}
                                />
                            </div>

                            <div className="input-group">
                                <label>Tope Ejecución Anual</label>
                                <input
                                    type="text"
                                    name="topeAnual"
                                    value={formData.topeAnual}
                                    onChange={handleChange}
                                    onFocus={(e) => handleChange({ target: { name: 'topeAnual', value: e.target.value.replace(/,/g, '') } })}
                                    onBlur={(e) => {
                                        const val = e.target.value.replace(/,/g, '');
                                        if (val && !isNaN(val)) {
                                            const formatted = Number(val).toLocaleString('en-US', { maximumFractionDigits: 10 });
                                            handleChange({ target: { name: 'topeAnual', value: formatted } });
                                        }
                                    }}
                                    placeholder="Opcional (Usa presupuesto si vacío)"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-border">
                {step === 2 ? (
                    <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={loading}>
                        Atrás
                    </button>
                ) : (
                    <button className="btn btn-ghost text-red-400 hover:text-red-500" onClick={onClose}>
                        Cancelar
                    </button>
                )}

                {step === 1 ? (
                    // Logic: Even in edit mode, allow going to 'Next' (Step 2) to edit period details
                    <button className="btn btn-primary" onClick={handleNext}>
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Creando...' : 'Crear Contrato'}
                        {!loading && <Save className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}
