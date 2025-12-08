
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { ContractWizard } from './components/ContractWizard'
import { ContractList } from './pages/ContractList';
import { ContractDetails } from './pages/ContractDetails';
import { OrderHistory } from './pages/OrderHistory';
import { Settings } from './pages/Settings';
import { BudgetInjections } from './pages/BudgetInjections';
import { Statistics } from './pages/Statistics';
import { Search, Bell, User } from 'lucide-react'

// Placeholder for other pages removed


function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [editingContract, setEditingContract] = useState(null);
  const [showWizard, setShowWizard] = useState(false)

  const handleNavigate = (tab, contractId = null) => {
    setActiveTab(tab);
    if (contractId) {
      setSelectedContractId(contractId);
    }
  };

  const handleEditContract = (contract) => {
    setEditingContract(contract);
    setShowWizard(true);
  };

  const renderContent = () => {
    if (showWizard) return (
      <ContractWizard
        contractToEdit={editingContract}
        onClose={() => {
          setShowWizard(false);
          setEditingContract(null);
        }}
        onSaveSuccess={() => {
          alert(editingContract ? 'Contrato actualizado exitosamente!' : 'Contrato creado exitosamente!');
          handleNavigate('contracts'); // Go to list after create/edit
          setShowWizard(false);
          setEditingContract(null);
        }}
      />
    )

    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />
      case 'contracts': return <ContractList onNavigate={handleNavigate} onEdit={handleEditContract} />
      case 'details': return <ContractDetails contractId={selectedContractId} onBack={() => handleNavigate('dashboard')} />
      case 'settings': return <Settings />
      case 'orders': return <OrderHistory />
      case 'injections': return <BudgetInjections mode="management" />
      case 'budget_history': return <BudgetInjections mode="history" />
      case 'statistics': return <Statistics />
      default: return <Dashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">

      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
          setShowWizard(false)
        }}
        onNewContract={() => setShowWizard(true)}
      />

      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Header Global */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-md">
          <h2 className="text-xl font-semibold tracking-tight">
            {showWizard ? 'Nuevo Contrato' : (
              {
                'dashboard': 'Dashboard General',
                'contracts': 'Contratos',
                'orders': 'Historial de Pedidos',
                'injections': 'Inyecciones Presupuestarias',
                'budget_history': 'Historial de Inyecciones',
                'statistics': 'Tablero de Estadísticas',
                'settings': 'Configuración de Sistema',
                'details': 'Detalles del Contrato'
              }[activeTab] || 'MedControl'
            )}
          </h2>

          <div className="flex items-center gap-6">
            {/* Global search and notifications removed */}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 bg-grid-white/[0.02]">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  )
}
// Debug listener
console.log("App loaded. Version: Statistics-Fix-1");

export default App
