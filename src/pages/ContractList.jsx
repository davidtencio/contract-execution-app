
import { useState, useEffect } from 'react';
import { useContracts, useDeleteContract } from '../hooks/useContracts';
import { Search, Filter, MoreHorizontal, FileText, Trash2, Pencil } from 'lucide-react';

export function ContractList({ onNavigate, onEdit }) {
    const { data: contracts = [], isLoading: loading } = useContracts();
    const deleteContractMutation = useDeleteContract();

    // Local state for UI only
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMenu, setActiveMenu] = useState(null);

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent row click
        if (window.confirm('¿Estás seguro de que deseas eliminar este contrato? Esta acción no se puede deshacer.')) {
            try {
                await deleteContractMutation.mutateAsync(id);
                setActiveMenu(null);
            } catch (error) {
                console.error("Error deleting contract:", error);
                alert("Error al eliminar contrato");
            }
        }
    };

    const handleEdit = (e, contract) => {
        e.stopPropagation();
        if (onEdit) onEdit(contract);
        setActiveMenu(null);
    };

    const toggleMenu = (e, id) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === id ? null : id);
    };

    // Close menu when clicking elsewhere
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const filteredContracts = contracts.filter(c =>
        c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.items?.some(item =>
            item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    const handleExportCSV = () => {
        const headers = [
            'ID', 'Código Contrato', 'Referencia Legal', 'Concurso', 'Periodos', 'Proveedor',
            'Item Código', 'Item Descripción', 'Precio Unitario', 'Moneda', 'Estado'
        ];

        let csvContent = headers.join(',') + '\n';

        filteredContracts.forEach(contract => {
            // Helper to escape CSV fields
            const esc = (field) => {
                if (field === null || field === undefined) return '';
                const stringField = String(field);
                if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                    return `"${stringField.replace(/"/g, '""')}"`;
                }
                return stringField;
            };

            const baseInfo = [
                contract.id,
                contract.codigo,
                contract.contratoLegal,
                contract.concurso,
                contract.periodos?.join(', ') || 'N/A', // Add Periodos to CSV
                contract.proveedor
            ];

            if (contract.items && contract.items.length > 0) {
                contract.items.forEach(item => {
                    const row = [
                        ...baseInfo,
                        item.codigo,
                        item.nombre,
                        item.precioUnitario,
                        item.moneda || contract.moneda || 'USD',
                        'Activo' // Assuming active based on list
                    ];
                    csvContent += row.map(esc).join(',') + '\n';
                });
            } else {
                // Contract without items
                const row = [
                    ...baseInfo,
                    '', // Item code
                    contract.nombre, // Use contract name as description
                    contract.precioUnitario,
                    contract.moneda || 'USD',
                    'Activo'
                ];
                csvContent += row.map(esc).join(',') + '\n';
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `contratos_export_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border border-border">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Buscar por código, nombre o proveedor..."
                        className="pl-10 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-ghost border border-border bg-background">
                        <Filter className="w-4 h-4" /> Filtros
                    </button>
                    <button onClick={handleExportCSV} className="btn btn-primary">
                        <FileText className="w-4 h-4 mr-2" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Contracts Table */}
            <div className="card overflow-hidden min-h-[400px]">
                <div className="overflow-visible">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-medium text-left">Ref. Legal</th>

                                <th className="px-6 py-4 font-medium text-center">Periodos</th>
                                <th className="px-6 py-4 font-medium text-center">Medicamento</th>
                                <th className="px-6 py-4 font-medium text-center">Proveedor</th>
                                <th className="px-6 py-4 font-medium text-center">Precio Unitario</th>
                                <th className="px-6 py-4 font-medium text-center">Estado</th>
                                <th className="px-6 py-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredContracts.map((contract) => (
                                <tr
                                    key={contract.id}
                                    className="hover:bg-muted/30 transition-colors group cursor-pointer relative"
                                    onClick={() => onNavigate && onNavigate('details', contract.id)}
                                >
                                    <td className="px-6 py-4 align-top text-left text-xs text-muted-foreground w-48">
                                        <div className="flex flex-col gap-1">
                                            {contract.concurso && <div><span className="font-semibold">Conc:</span> {contract.concurso}</div>}
                                            {contract.contratoLegal && <div><span className="font-semibold">Cont:</span> {contract.contratoLegal}</div>}
                                        </div>
                                    </td>
                                    {/* Periodos Column */}
                                    <td className="px-6 py-4 align-top text-center text-xs font-medium text-foreground">
                                        <div className="flex flex-wrap gap-1 max-w-[150px] justify-center mx-auto">
                                            {contract.periodos && contract.periodos.length > 0 ? (
                                                contract.periodos.map((p, idx) => (
                                                    <span key={idx} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                                                        {p}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-muted-foreground italic">Sin periodos</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium align-top text-center">
                                        {contract.items?.length > 0 ? (
                                            <div className="flex flex-col gap-3 items-center">
                                                {[...contract.items].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((item, idx) => (
                                                    <div key={idx} className="text-sm truncate max-w-[200px] h-6 flex items-center justify-center" title={item.nombre}>
                                                        {item.nombre} ({item.codigo})
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                {contract.nombre} {contract.codigo ? `(${contract.codigo})` : ''}
                                            </>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground align-top text-center">{contract.proveedor}</td>
                                    <td className="px-6 py-4 font-mono align-top text-center">
                                        {contract.items?.length > 0 ? (
                                            <div className="flex flex-col gap-3 items-center">
                                                {contract.items.map((item, idx) => (
                                                    <div key={idx} className="text-sm h-6 flex items-center justify-center">
                                                        {item.moneda === 'CRC' ? '₡' : '$'}{Number(item.precioUnitario).toLocaleString('en-US')}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>{contract.moneda === 'CRC' ? '₡' : '$'}{Number(contract.precioUnitario).toLocaleString('en-US')}</>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center align-top">
                                        <span className="badge badge-active">Activo</span>
                                    </td>
                                    <td className="px-6 py-4 text-right relative">
                                        <button
                                            className="btn btn-ghost p-2 hover:bg-background rounded-full transition-opacity opacity-100"
                                            onClick={(e) => toggleMenu(e, contract.id)}
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {activeMenu === contract.id && (
                                            <div className="absolute right-8 top-8 z-50 w-48 rounded-xl border border-white/10 bg-[#0f172a] shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden ring-1 ring-black/50">
                                                <div className="p-1.5 flex flex-col gap-1">
                                                    <button
                                                        onClick={(e) => handleEdit(e, contract)}
                                                        className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 hover:text-white transition-all rounded-lg flex items-center gap-3 group/item"
                                                    >
                                                        <Pencil className="w-4 h-4 text-blue-400 group-hover/item:text-blue-300" />
                                                        <span className="font-medium">Editar</span>
                                                    </button>
                                                    <div className="h-px bg-white/10 my-0.5 mx-2" />
                                                    <button
                                                        onClick={(e) => handleDelete(e, contract.id)}
                                                        className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all rounded-lg flex items-center gap-3 group/item"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-500 group-hover/item:text-red-400" />
                                                        <span className="font-medium">Eliminar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {filteredContracts.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="w-8 h-8 opacity-20" />
                                            <p>No se encontraron contratos coincidenes.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
