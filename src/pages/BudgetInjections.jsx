import { useState, useEffect } from 'react';
import { ContractService } from '../services/ContractService';
import { Plus, FileText, Search, TrendingUp, ArrowRight, ExternalLink, Pencil, X } from 'lucide-react';
import { BudgetInjectionForm } from '../components/BudgetInjectionForm';
import { BudgetInjectionModal } from '../components/BudgetInjectionModal';

export function BudgetInjections({ mode = 'management' }) {
    const [injections, setInjections] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [selectedContractId, setSelectedContractId] = useState('');

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingInjection, setEditingInjection] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Search states
    const [contractSearch, setContractSearch] = useState('');
    const [injectionSearch, setInjectionSearch] = useState('');

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const allInjections = await ContractService.getAllInjections();
            const allContracts = await ContractService.getAllContracts();

            // Enrich contracts with balance data
            // Requires fetching periods/orders per contract which is heavy.
            // Optimization: Fetch all periods/orders might be too much.
            // Let's iterate and await (or Promise.all)

            const enriched = await Promise.all(allContracts.map(async c => {
                const periods = await ContractService.getPeriodsByContractId(c.id);
                const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];
                if (!activePeriod) return { ...c, saldo: 0 };

                // Calc balance: (Initial + Injections) - (Orders)
                // periodInjections can be filtered from allInjections if it has periodId, 
                // OR we fetch specific injections. Ideally Filter.
                // Assuming allInjections has periodId
                const periodInjections = allInjections.filter(i => String(i.periodId) === String(activePeriod.id));
                const totalInjected = periodInjections.reduce((sum, i) => sum + parseFloat(i.amount), 0);

                const orders = await ContractService.getOrdersByPeriodId(activePeriod.id);
                const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.monto || 0), 0); // Note: check order model field name (monto vs montoTotal)

                const initialBudget = parseFloat(activePeriod.presupuestoAsignado || activePeriod.presupuestoInicial || 0);
                const saldo = initialBudget + totalInjected - totalSpent;

                let rawCurrency = (activePeriod.moneda || c.moneda || 'USD').toUpperCase();
                let currency = 'USD';
                if (rawCurrency.includes('COLONES') || rawCurrency.includes('CRC') || rawCurrency === 'COLON') {
                    currency = 'CRC';
                }
                return { ...c, saldo, currency };
            }));

            setInjections(allInjections);
            setContracts(enriched);
        } catch (error) {
            console.error("Error loading budget data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddInjection = async (data) => {
        try {
            // Check if updating
            if (editingInjection) {
                await ContractService.updateBudgetInjection(editingInjection.id, data);
                alert('Inyección actualizada correctamente');
                handleCloseEdit();
            } else {
                const periods = await ContractService.getPeriodsByContractId(parseInt(selectedContractId));
                const activePeriod = periods.find(p => p.estado === 'Activo') || periods[0];

                if (!activePeriod) {
                    alert('El contrato seleccionado no tiene periodos activos');
                    return;
                }

                await ContractService.addBudgetInjection({
                    contractId: parseInt(selectedContractId),
                    periodId: activePeriod.id,
                    ...data
                });
                alert('Inyección aplicada correctamente');
                setSelectedContractId(''); // Reset selection only on add
            }
            await loadData();
        } catch (error) {
            console.error("Error saving injection:", error);
            alert("Error al guardar inyección");
        }
    };

    const handleEditClick = (injection) => {
        setEditingInjection(injection);
        if (mode === 'history') {
            setIsEditModalOpen(true);
        } else {
            // In management mode, select the contract and scroll up
            setSelectedContractId(String(injection.contractId));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCloseEdit = () => {
        setEditingInjection(null);
        setIsEditModalOpen(false);
    };

    const filteredContracts = contracts.filter(c => {
        const searchLower = contractSearch.toLowerCase();

        // Helper to check if a value includes the search term
        const check = (val) => (val || '').toLowerCase().includes(searchLower);

        // Search in main fields
        const mainMatch = check(c.nombre) ||
            check(c.codigo) ||
            check(c.proveedor) ||
            check(c.contratoLegal) ||
            check(c.concurso);

        // Search in items if they exist
        const itemsMatch = c.items && c.items.some(item =>
            check(item.nombre) || check(item.codigo)
        );

        return mainMatch || itemsMatch;
    });

    const filteredInjections = injections.filter(inj => {
        if (selectedContractId) {
            return String(inj.contractId) === String(selectedContractId);
        }
        return (inj.contractName || '').toLowerCase().includes(injectionSearch.toLowerCase()) ||
            (inj.contractCode || '').toLowerCase().includes(injectionSearch.toLowerCase()) ||
            (inj.oficioNumber || '').toLowerCase().includes(injectionSearch.toLowerCase());
    });

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        {mode === 'history' ? 'Historial Global de Inyecciones' : 'Inyecciones de Presupuesto'}
                    </h1>
                    <p className="text-muted-foreground">
                        {mode === 'history'
                            ? 'Visualice el registro completo de todas las inyecciones presupuestarias del sistema.'
                            : 'Seleccione un contrato para gestionar sus adiciones presupuestarias.'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start flex-1 min-h-0">

                    {/* Header Actions */}
                    <div className="md:col-span-12 flex justify-end mb-2">
                        {mode === 'history' && (
                            <button
                                onClick={() => {
                                    const headers = ['Fecha', 'Inyección ID', 'Contrato', 'Proveedor', 'Oficio', 'Monto', 'Moneda', 'Descripción'];
                                    let csvContent = headers.join(',') + '\n';

                                    const esc = (field) => {
                                        if (field === null || field === undefined) return '';
                                        const stringField = String(field);
                                        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                                            return `"${stringField.replace(/"/g, '""')}"`;
                                        }
                                        return stringField;
                                    };

                                    const injectionsToExport = loadingInjections || injections; // Use current state

                                    injectionsToExport.forEach(inj => {
                                        // Find contract to get details if needed, though inj should have basic info
                                        // Assuming inj has flattened info or we lookup
                                        const contract = contracts.find(c => String(c.id) === String(inj.contractId)) || {};

                                        const row = [
                                            (inj.date || inj.fecha || '').split('T')[0],
                                            inj.id,
                                            contract.contratoLegal || contract.codigo || inj.contractId,
                                            contract.proveedor || '-',
                                            inj.oficioNumber || '-',
                                            inj.amount,
                                            inj.currency || contract.currency || 'USD',
                                            inj.notes || inj.description || ''
                                        ];
                                        csvContent += row.map(esc).join(',') + '\n';
                                    });

                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.setAttribute('href', url);
                                    link.setAttribute('download', `inyecciones_presupuesto_${new Date().toISOString().slice(0, 10)}.csv`);
                                    link.style.visibility = 'hidden';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="btn btn-ghost border border-border hover:bg-muted text-sm gap-2"
                            >
                                <ExternalLink className="w-4 h-4 rotate-180" /> {/* Reuse icon or import Download */}
                                Exportar CSV
                            </button>
                        )}
                    </div>

                    {/* LEFT COLUMN: Contract Selection (Span 4) - ONLY IN MANAGEMENT MODE */}
                    {mode === 'management' && (
                        <div className="md:col-span-4 flex flex-col gap-4 h-full">
                            <div className="card bg-card border border-border shadow-sm flex flex-col h-full overflow-hidden">
                                <div className="p-4 border-b border-border bg-muted/30">
                                    <h3 className="font-semibold text-sm mb-3">Contratos Activos</h3>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <input
                                            placeholder="Buscar contrato..."
                                            className="w-full bg-background border border-input rounded-md pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                            value={contractSearch}
                                            onChange={(e) => setContractSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {filteredContracts.length > 0 ? (
                                        filteredContracts.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    // Debug log
                                                    console.log('Opening modal for contract:', c.id);
                                                    setSelectedContractId(String(c.id));
                                                    setIsAddModalOpen(true);
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex flex-col gap-1 border
                                                ${String(selectedContractId) === String(c.id)
                                                        ? 'bg-primary/5 border-primary/50 shadow-sm relative overflow-hidden'
                                                        : 'bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                {String(selectedContractId) === String(c.id) && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                                )}

                                                <div className="grid grid-cols-12 gap-2 mb-1 items-center w-full">
                                                    {/* Info Column (Left 8) */}
                                                    <div className="col-span-8 flex flex-col gap-0.5 animate-in fade-in duration-300">
                                                        <span className={`font-semibold ${String(selectedContractId) === String(c.id) ? 'text-primary' : ''}`}>
                                                            {c.contratoLegal || c.codigo}
                                                        </span>
                                                        {c.proveedor && (
                                                            <span className="text-xs font-medium opacity-90 truncate max-w-[180px]">
                                                                {c.proveedor}
                                                            </span>
                                                        )}
                                                        {c.concurso && (
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <span className="opacity-70">Conc:</span> {c.concurso}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Saldo Display - Central layout (Right 4) */}
                                                    <div className="col-span-4 flex flex-col items-center justify-center border-l border-border/50 pl-2">
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">SALDO</span>
                                                        <span className={`text-sm font-bold tracking-tight ${(c.saldo || 0) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {(c.saldo || 0).toLocaleString('en-US', { style: 'currency', currency: c.currency || 'USD' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Display all items or fallback name */}
                                                <div className="space-y-0.5 mt-1 w-full">
                                                    {c.items && c.items.length > 0 ? (
                                                        c.items.map((item, idx) => (
                                                            <div key={idx} className="text-xs opacity-80 flex items-start gap-1.5">
                                                                <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0" />
                                                                <span className={contractSearch && (item.nombre || '').toLowerCase().includes(contractSearch.toLowerCase()) ? "text-primary font-medium" : ""}>
                                                                    {item.nombre || 'Sin nombre'}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs truncate w-full opacity-80 line-clamp-2">
                                                            {c.nombre}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-xs text-muted-foreground">
                                            No se encontraron contratos.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RIGHT COLUMN: Action & History (Span 8 or 12 depending on mode) */}
                    <div className={`${mode === 'management' ? 'md:col-span-8' : 'md:col-span-12'} h-full overflow-y-auto pr-1`}>

                        {/* HISTORY MODE: Show Global Table Directly */}
                        {mode === 'history' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="card overflow-hidden border border-border shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/50">
                                                <th className="p-3 font-medium text-muted-foreground text-center">Fecha de Inyección</th>
                                                <th className="p-3 font-medium text-muted-foreground text-center">Concurso</th>
                                                <th className="p-3 font-medium text-muted-foreground text-center">Contrato</th>
                                                <th className="p-3 font-medium text-muted-foreground text-center">Monto</th>
                                                <th className="p-3 font-medium text-muted-foreground text-center w-24">Editar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {injections.length > 0 ? (
                                                injections.map(inj => (
                                                    <tr key={inj.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                                        <td className="p-3 text-center">{new Date(inj.date).toLocaleDateString()}</td>
                                                        <td className="p-3 text-center">
                                                            <span className="bg-secondary/50 px-2 py-0.5 rounded text-xs font-mono">
                                                                {inj.concurso || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-medium">{inj.contractCode || inj.contractLegal}</span>
                                                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                                                    {inj.contractName}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <a
                                                                href={inj.fileData || '#'}
                                                                download={inj.fileData ? inj.pdfName : undefined}
                                                                target={inj.fileData ? "_blank" : undefined}
                                                                className={`inline-flex items-center gap-1 font-semibold ${inj.fileData ? 'text-primary hover:underline' : 'text-muted-foreground cursor-not-allowed'}`}
                                                                title={`Ver oficio: ${inj.oficioNumber}`}
                                                                onClick={(e) => {
                                                                    if (!inj.fileData) {
                                                                        e.preventDefault();
                                                                        alert(`El documento ${inj.pdfName || ''} no está disponible para previsualización.`);
                                                                    }
                                                                }}
                                                            >
                                                                {inj.amount.toLocaleString('en-US', { style: 'currency', currency: inj.currency || 'CRC' })}
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => handleEditClick(inj)}
                                                                className="flex items-center justify-center mx-auto p-1.5 transition-transform hover:scale-110 !bg-transparent !border-0 !shadow-none ring-0 outline-none"
                                                                style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                                                                title="Editar Inyección"
                                                            >
                                                                <Pencil className="w-4 h-4 text-red-600" color="#DC2626" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="p-12 text-center text-muted-foreground">
                                                        No hay inyecciones registradas en el sistema.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* MANAGEMENT MODE: Show Selection or Form */}
                        {mode === 'management' && (
                            selectedContractId ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* CONTRACT SPECIFIC HISTORY */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-muted-foreground" />
                                            Historial de Inyecciones
                                        </h3>
                                        <div className="card overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-border bg-muted/50">
                                                        <th className="p-3 font-medium text-muted-foreground text-center">Fecha</th>
                                                        <th className="p-3 font-medium text-muted-foreground text-center">Oficio</th>
                                                        <th className="p-3 font-medium text-muted-foreground text-center">Monto</th>
                                                        <th className="p-3 font-medium text-muted-foreground text-center">Doc</th>
                                                        <th className="p-3 font-medium text-muted-foreground text-center w-24">Editar</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredInjections.length > 0 ? (
                                                        filteredInjections.map(inj => (
                                                            <tr key={inj.id} className="border-b border-border hover:bg-muted/30">
                                                                <td className="p-3 text-center">{new Date(inj.date).toLocaleDateString()}</td>
                                                                <td className="p-3 text-center">
                                                                    <span className="bg-secondary px-2 py-0.5 rounded text-xs">
                                                                        {inj.oficioNumber}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center font-medium text-green-600">
                                                                    +{inj.amount.toLocaleString('en-US', { style: 'currency', currency: 'CRC' })}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    {inj.fileData ? (
                                                                        <a
                                                                            href={inj.fileData}
                                                                            download={inj.pdfName}
                                                                            target="_blank"
                                                                            className="text-primary hover:text-primary/80 transition-colors"
                                                                            title="Descargar documento"
                                                                        >
                                                                            <FileText className="w-4 h-4" />
                                                                        </a>
                                                                    ) : (
                                                                        <FileText className="w-4 h-4 text-muted-foreground/50 cursor-not-allowed" title="No disponible" />
                                                                    )}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <button
                                                                        onClick={() => handleEditClick(inj)}
                                                                        className="flex items-center justify-center mx-auto p-1.5 transition-transform hover:scale-110 !bg-transparent !border-0 !shadow-none ring-0 outline-none"
                                                                        style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                                                                        title="Editar Inyección"
                                                                    >
                                                                        <Pencil className="w-4 h-4 text-red-600" color="#DC2626" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="5" className="p-8 text-center text-muted-foreground text-xs">
                                                                Este contrato aún no tiene inyecciones registradas.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // EMPTY STATE for Management Mode
                                <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/5">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                                        <ArrowRight className="w-8 h-8 text-primary" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Seleccione un Contrato</h3>
                                    <p className="text-muted-foreground max-w-sm">
                                        Elija un contrato de la lista de la izquierda para registrar nuevas inyecciones o ver su historial específico.
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>

            </div>

            {/* EDIT MODAL FOR HISTORY MODE */}
            {isEditModalOpen && editingInjection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-lg relative">
                        <button
                            onClick={handleCloseEdit}
                            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <BudgetInjectionForm
                            contractCode={editingInjection.contractCode}
                            initialCurrency={editingInjection.currency || 'CRC'}
                            initialData={editingInjection}
                            onSubmit={handleAddInjection}
                            onCancel={handleCloseEdit}
                        />
                    </div>
                </div>
            )}

            {/* NEW INJECTION MODAL - User Request */}
            {isAddModalOpen && selectedContractId && (
                <BudgetInjectionModal
                    contractCode={contracts.find(c => String(c.id) === String(selectedContractId))?.codigo}
                    onClose={() => setIsAddModalOpen(false)}
                    onSubmit={async (data) => {
                        await handleAddInjection(data);
                        setIsAddModalOpen(false);
                    }}
                />
            )}
        </>
    );
}
