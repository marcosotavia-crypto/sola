import { useState, useEffect, FormEvent } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Plus, 
  Package, 
  Barcode, 
  CheckCircle2, 
  Search, 
  Printer, 
  LayoutDashboard, 
  X, 
  Trash2, 
  Activity, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Maximize2,
  Settings,
  Users,
  CalendarDays,
  ListPlus,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeComponent from 'react-barcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FootwearItem, Operator, Programming } from './types';
import { productionService } from './services/productionService';
import { db } from './lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function App() {
  return (
    <AppContent />
  );
}

function AppContent() {
  const [items, setItems] = useState<FootwearItem[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [programmings, setProgrammings] = useState<Programming[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<FootwearItem | null>(null);
  
  // Form states
  const [orderNumber, setOrderNumber] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState('');
  const [newOperatorName, setNewOperatorName] = useState('');
  const [pairsPerLabel, setPairsPerLabel] = useState(10);
  const [sizeQuantities, setSizeQuantities] = useState<{ size: string; quantity: number }[]>([
    { size: '34', quantity: 0 },
    { size: '35', quantity: 0 },
    { size: '36', quantity: 0 },
    { size: '37', quantity: 0 },
    { size: '38', quantity: 0 },
    { size: '39', quantity: 0 },
    { size: '40', quantity: 0 },
  ]);
  
  // Programming form states
  const [progName, setProgName] = useState('');
  const [progDesc, setProgDesc] = useState('');
  const [selectedOrdersForProg, setSelectedOrdersForProg] = useState<string[]>([]);
  
  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [progToDelete, setProgToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'productionItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FootwearItem));
      setItems(data);
    }, (error) => {
      console.error("Firestore Error:", error);
      toast.error("Erro ao carregar dados em tempo real. Verifique permissões.");
    });

    const qOps = query(collection(db, 'operators'), orderBy('name', 'asc'));
    const unsubscribeOps = onSnapshot(qOps, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Operator));
      setOperators(data);
    }, (error) => {
      console.error("Operators Error:", error);
    });

    const qProgs = query(collection(db, 'programmings'), orderBy('createdAt', 'desc'));
    const unsubscribeProgs = onSnapshot(qProgs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Programming));
      setProgrammings(data);
    }, (error) => {
      console.error("Programmings Error:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeOps();
      unsubscribeProgs();
    };
  }, []);

  const handleAddOperator = async (e: FormEvent) => {
    e.preventDefault();
    if (!newOperatorName.trim()) return;
    try {
      await productionService.addOperator(newOperatorName.trim().toUpperCase());
      setNewOperatorName('');
      toast.success('Operador cadastrado!');
    } catch (error) {
      toast.error('Erro ao cadastrar operador');
    }
  };

  const handleRemoveOperator = async (id: string) => {
    try {
      await productionService.deleteOperator(id);
      toast.success('Operador removido');
    } catch (error) {
      toast.error('Erro ao remover operador');
    }
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();

    const activeSizes = sizeQuantities.filter(sq => sq.quantity > 0);

    if (!orderNumber || !model || !color || !orderDate || !deadline || activeSizes.length === 0) {
      toast.error('Preencha todos os campos, incluindo as datas, e pelo menos uma quantidade');
      return;
    }

    if (!pairsPerLabel || pairsPerLabel < 1) {
      toast.error('A quantidade de pares por etiqueta deve ser pelo menos 1');
      return;
    }

    try {
      await productionService.createOrder({ 
        orderNumber, 
        model, 
        color, 
        sizeQuantities: activeSizes,
        pairsPerLabel,
        orderDate: new Date(orderDate).getTime(),
        deadline: new Date(deadline).getTime()
      });
      toast.success('Pedido cadastrado com sucesso!');
      setOrderNumber('');
      setModel('');
      setColor('');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setDeadline('');
      setSizeQuantities(sizeQuantities.map(sq => ({ ...sq, quantity: 0 })));
      setActiveTab('dashboard');
    } catch (error) {
      toast.error('Erro ao cadastrar pedido');
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      await productionService.deleteOrder(orderToDelete);
      toast.success(`Pedido ${orderToDelete} excluído com sucesso`);
      setOrderToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pedido');
    }
  };

  const handleManualStatusToggle = async (item: FootwearItem) => {
    const newStatus = item.status === 'Produzido' ? 'Pendente' : 'Produzido';
    try {
      const success = await productionService.updateStatus(item.barcode, newStatus, operatorName || 'ADMIN');
      if (success) {
        toast.success(`Status atualizado para ${newStatus}`);
      } else {
        toast.error('Erro ao atualizar status');
      }
    } catch (error) {
      toast.error('Erro ao processar atualização');
    }
  };

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!scanInput) return;
    
    if (!operatorName) {
      toast.error('Por favor, identifique o operador antes de bipar');
      return;
    }

    try {
      const success = await productionService.updateStatus(scanInput, 'Produzido', operatorName);
      if (success) {
        toast.success(`Baixa realizada: ${scanInput}`);
      } else {
        toast.error('Código não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao processar baixa');
    }
    setScanInput('');
  };

  const handleCreateProgramming = async (e: FormEvent) => {
    e.preventDefault();
    if (!progName || selectedOrdersForProg.length === 0) {
      toast.error('Preencha o nome e selecione pelo menos um pedido');
      return;
    }

    try {
      await productionService.createProgramming(progName, progDesc, selectedOrdersForProg);
      toast.success('Programação criada com sucesso!');
      setProgName('');
      setProgDesc('');
      setSelectedOrdersForProg([]);
      setActiveTab('programmings');
    } catch (error) {
      toast.error('Erro ao criar programação');
    }
  };

  const handleDeleteProgramming = async () => {
    if (!progToDelete) return;
    try {
      await productionService.deleteProgramming(progToDelete);
      toast.success('Programação excluída');
      setProgToDelete(null);
    } catch (error) {
      toast.error('Erro ao excluir programação');
    }
  };

  const toggleOrderSelection = (orderNum: string) => {
    setSelectedOrdersForProg(prev => 
      prev.includes(orderNum) 
        ? prev.filter(o => o !== orderNum) 
        : [...prev, orderNum]
    );
  };

  const updateSizeQuantity = (size: string, qty: number) => {
    setSizeQuantities(prev => prev.map(sq => sq.size === size ? { ...sq, quantity: Math.max(0, qty) } : sq));
  };

  const filteredItems = items.filter(item => 
    item.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: items.reduce((acc, i) => acc + (i.quantity || 0), 0),
    produced: items.filter(i => i.status === 'Produzido').reduce((acc, i) => acc + (i.quantity || 0), 0),
    pending: items.filter(i => i.status === 'Pendente').reduce((acc, i) => acc + (i.quantity || 0), 0),
  };

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.orderNumber]) {
      acc[item.orderNumber] = [];
    }
    acc[item.orderNumber].push(item);
    return acc;
  }, {} as Record<string, FootwearItem[]>);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintAll = (orderItems: FootwearItem[]) => {
    toast.info('Preparando etiquetas para impressão...');
    window.print();
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans text-gray-200">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 bottom-0 w-20 md:w-64 bg-brand-card border-r border-brand-border z-20 print:hidden">
        <div className="p-6 flex items-center gap-3 mb-8">
          <div className="bg-brand-accent text-black p-2 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Package size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tighter hidden md:block">FOOTWEAR<span className="text-brand-accent">PRO</span></h1>
        </div>

        <nav className="px-3 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium hidden md:block">Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('new-order')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'new-order' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <Plus size={20} />
            <span className="font-medium hidden md:block">Novo Pedido</span>
          </button>
          <button 
            onClick={() => setActiveTab('programmings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'programmings' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={20} />
            <span className="font-medium hidden md:block">Programação</span>
          </button>
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'scanner' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <Barcode size={20} />
            <span className="font-medium hidden md:block">Bipar Produção</span>
          </button>
          <button 
            onClick={() => setActiveTab('operators')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'operators' ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <Users size={20} />
            <span className="font-medium hidden md:block">Operadores</span>
          </button>
        </nav>

        <div className="absolute bottom-8 left-0 right-0 px-3">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all">
            <Settings size={20} />
            <span className="font-medium hidden md:block">Configurações</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-20 md:ml-64 p-4 md:p-8 min-h-screen print:ml-0 print:p-0">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:hidden">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeTab === 'dashboard' && 'Visão Geral da Produção'}
              {activeTab === 'new-order' && 'Configurar Novo Lote'}
              {activeTab === 'programmings' && 'Programação de Produção'}
              {activeTab === 'scanner' && 'Terminal de Leitura'}
              {activeTab === 'operators' && 'Gestão de Equipe'}
            </h2>
            <p className="text-gray-500 text-sm">
              {activeTab === 'dashboard' && 'Acompanhe o status de todos os pedidos em tempo real.'}
              {activeTab === 'new-order' && 'Defina a grade e gere as etiquetas de rastreamento.'}
              {activeTab === 'programmings' && 'Agrupe pedidos em programações semanais ou diárias.'}
              {activeTab === 'scanner' && 'Utilize o leitor de código de barras para registrar a produção.'}
              {activeTab === 'operators' && 'Cadastre e gerencie os operadores da fábrica.'}
            </p>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <Input 
                placeholder="Buscar pedido..." 
                className="pl-10 bg-brand-card border-brand-border focus-visible:ring-brand-accent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        <Tabs value={activeTab} className="w-full">
          <AnimatePresence mode="wait">
            <TabsContent value="dashboard" key="dashboard">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Bento Grid Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-brand-card border-brand-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity size={64} />
                    </div>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Total de Pares</CardDescription>
                      <CardTitle className="text-3xl font-mono">{(stats.total || 0)}</CardTitle>
                    </CardHeader>
                  </Card>
                  
                  <Card className="bg-brand-card border-brand-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-brand-accent">
                      <CheckCircle2 size={64} />
                    </div>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Produzidos</CardDescription>
                      <CardTitle className="text-3xl font-mono text-brand-accent">{(stats.produced || 0)}</CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="bg-brand-card border-brand-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-amber-500">
                      <Clock size={64} />
                    </div>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Pendentes</CardDescription>
                      <CardTitle className="text-3xl font-mono text-amber-500">{(stats.pending || 0)}</CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="bg-brand-card border-brand-border overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-blue-500">
                      <TrendingUp size={64} />
                    </div>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Eficiência</CardDescription>
                      <CardTitle className="text-3xl font-mono text-blue-500">
                        {(stats.total > 0 && !isNaN(stats.produced)) ? Math.round((stats.produced / stats.total) * 100) : 0}%
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Orders List */}
                <div className="space-y-6">
                  {(Object.entries(groupedItems) as [string, FootwearItem[]][]).sort((a,b) => (b[1][0].createdAt || 0) - (a[1][0].createdAt || 0)).map(([orderNum, orderItems], idx) => (
                    <motion.div
                      key={orderNum}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="bg-brand-card border-brand-border overflow-hidden group">
                        <div className="bg-white/5 border-b border-brand-border px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded bg-brand-accent/10 flex items-center justify-center text-brand-accent border border-brand-accent/20">
                              <Package size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-brand-accent uppercase tracking-widest">Lote Ativo</span>
                                <h3 className="text-lg font-bold font-mono">#{orderNum}</h3>
                              </div>
                              <p className="text-xs text-gray-500 font-medium">{orderItems[0].model} • {orderItems[0].color}</p>
                              <div className="flex gap-4 mt-1">
                                <p className="text-[10px] text-gray-500 font-mono uppercase">Pedido: {new Date(orderItems[0].orderDate).toLocaleDateString('pt-BR')}</p>
                                <p className={`text-[10px] font-mono uppercase font-bold ${
                                  (orderItems[0].deadline < Date.now() && orderItems.some(i => i.status !== 'Produzido')) 
                                    ? 'text-red-500' 
                                    : 'text-gray-500'
                                }`}>
                                  Limite: {new Date(orderItems[0].deadline).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 w-full sm:w-auto">
                            <div className="flex-1 sm:flex-none">
                              <div className="flex justify-between text-[10px] font-mono uppercase text-gray-500 mb-1">
                                <span>Progresso</span>
                                <span>{Math.round((orderItems.filter(i => i.status === 'Produzido').length / orderItems.length) * 100)}%</span>
                              </div>
                              <div className="h-1.5 w-full sm:w-32 bg-brand-border rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-brand-accent transition-all duration-500" 
                                  style={{ width: `${(orderItems.filter(i => i.status === 'Produzido').length / orderItems.length) * 100}%` }}
                                />
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="h-8 bg-transparent border-brand-border hover:bg-white/5" onClick={() => handlePrintAll(orderItems)}>
                                <Printer size={14} className="mr-2" /> Etiquetas
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => setOrderToDelete(orderNum)}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent border-brand-border">
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Tam</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Qtd</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Barcode ID</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Status</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Operador</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4">Data/Hora</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-gray-500 py-4 text-right">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orderItems.sort((a,b) => a.size.localeCompare(b.size)).map((item) => (
                                <TableRow key={item.id} className="border-brand-border hover:bg-white/[0.02] transition-colors group/row">
                                  <TableCell className="font-mono font-bold text-brand-accent">{item.size}</TableCell>
                                  <TableCell className="font-mono text-sm">{(item.quantity || 0)} <span className="text-[10px] text-gray-500">PARES</span></TableCell>
                                  <TableCell>
                                    <code className="font-mono text-[10px] bg-white/5 px-2 py-1 rounded border border-white/5">{item.barcode}</code>
                                  </TableCell>
                                  <TableCell>
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      item.status === 'Produzido' 
                                        ? 'bg-brand-accent/10 text-brand-accent' 
                                        : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                      <div className={`h-1 w-1 rounded-full ${item.status === 'Produzido' ? 'bg-brand-accent' : 'bg-amber-500'}`} />
                                      {item.status}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[10px] font-mono text-gray-400 uppercase">{item.producedBy || '-'}</span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-[10px] font-mono text-gray-400">
                                      {item.status === 'Produzido' ? new Date(item.updatedAt).toLocaleString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className={`h-7 w-7 rounded ${item.status === 'Produzido' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-brand-accent hover:bg-brand-accent/10'}`}
                                        onClick={() => handleManualStatusToggle(item)}
                                      >
                                        {item.status === 'Produzido' ? <X size={14} /> : <CheckCircle2 size={14} />}
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 rounded text-gray-400 hover:text-white hover:bg-white/10"
                                        onClick={() => setSelectedItem(item)}
                                      >
                                        <Maximize2 size={14} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="new-order" key="new-order">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-4xl mx-auto"
              >
                <Card className="bg-brand-card border-brand-border shadow-2xl">
                  <CardHeader className="border-b border-brand-border pb-6">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Plus className="text-brand-accent" size={20} />
                      Configuração de Lote
                    </CardTitle>
                    <CardDescription>Preencha os dados técnicos para gerar as etiquetas de rastreamento.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-8">
                    <form onSubmit={handleCreateOrder} className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="orderNum" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Nº do Pedido</Label>
                          <Input id="orderNum" placeholder="Ex: PED1001" className="bg-brand-bg border-brand-border font-mono" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Modelo</Label>
                          <Input id="model" placeholder="Ex: Tênis Casual" className="bg-brand-bg border-brand-border" value={model} onChange={e => setModel(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Cor</Label>
                          <Input id="color" placeholder="Ex: Preto" className="bg-brand-bg border-brand-border" value={color} onChange={e => setColor(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="orderDate" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Data do Pedido</Label>
                          <Input id="orderDate" type="date" className="bg-brand-bg border-brand-border font-mono" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deadline" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Data Limite (Entrega)</Label>
                          <Input id="deadline" type="date" className="bg-brand-bg border-brand-border font-mono" value={deadline} onChange={e => setDeadline(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pairsPerLabel" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Pares / Etiqueta</Label>
                          <Input 
                            id="pairsPerLabel" 
                            type="number" 
                            className="bg-brand-bg border-brand-border font-mono"
                            value={pairsPerLabel || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              setPairsPerLabel(val === '' ? 0 : parseInt(val) || 0);
                            }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-bold uppercase tracking-widest text-brand-accent">Grade de Produção</Label>
                          <span className="text-[10px] text-gray-500 font-mono">Total: {sizeQuantities.reduce((a, b) => a + (b.quantity || 0), 0)} pares</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                          {sizeQuantities.map((sq) => (
                            <div key={sq.size} className="relative group">
                              <div className="absolute -top-2 -left-1 px-1.5 py-0.5 bg-brand-accent text-black text-[9px] font-bold rounded z-10">
                                {sq.size}
                              </div>
                              <Input 
                                type="number" 
                                className="h-14 text-center font-mono font-bold bg-brand-bg border-brand-border focus-visible:ring-brand-accent pt-4" 
                                value={sq.quantity || ''} 
                                onChange={(e) => updateSizeQuantity(sq.size, parseInt(e.target.value) || 0)}
                              />
                            </div>
                          ))}
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-14 border-dashed border-brand-border bg-transparent hover:bg-white/5 hover:border-brand-accent group"
                            onClick={() => {
                              const nextSize = (parseInt(sizeQuantities[sizeQuantities.length - 1].size) + 1).toString();
                              setSizeQuantities([...sizeQuantities, { size: nextSize, quantity: 0 }]);
                            }}
                          >
                            <Plus size={16} className="group-hover:text-brand-accent" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
                        <Button type="button" variant="ghost" className="hover:bg-white/5" onClick={() => setActiveTab('dashboard')}>Cancelar</Button>
                        <Button type="submit" className="bg-brand-accent text-black hover:bg-brand-accent/90 px-10">CRIAR LOTE</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="programmings" key="programmings">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Create Programming Form */}
                  <Card className="bg-brand-card border-brand-border lg:col-span-1 h-fit">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ListPlus className="text-brand-accent" size={20} />
                        Nova Programação
                      </CardTitle>
                      <CardDescription>Agrupe pedidos para produção.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateProgramming} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Nome da Programação</Label>
                          <Input 
                            placeholder="Ex: Semana 15 - Setor A" 
                            className="bg-brand-bg border-brand-border"
                            value={progName}
                            onChange={e => setProgName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Descrição (Opcional)</Label>
                          <Input 
                            placeholder="Notas adicionais..." 
                            className="bg-brand-bg border-brand-border"
                            value={progDesc}
                            onChange={e => setProgDesc(e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <Label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Selecionar Pedidos</Label>
                          <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {Object.keys(groupedItems).length === 0 && (
                              <p className="text-xs text-gray-600 italic">Nenhum pedido disponível.</p>
                            )}
                            {Object.keys(groupedItems).map(orderNum => {
                              const isAlreadyInProg = programmings.some(p => p.orderNumbers.includes(orderNum));
                              return (
                                <div 
                                  key={orderNum} 
                                  className={`flex items-center space-x-3 p-2 rounded border transition-colors ${
                                    selectedOrdersForProg.includes(orderNum) 
                                      ? 'bg-brand-accent/10 border-brand-accent/30' 
                                      : 'bg-brand-bg/50 border-brand-border'
                                  } ${isAlreadyInProg ? 'opacity-50' : ''}`}
                                >
                                  <Checkbox 
                                    id={`order-${orderNum}`} 
                                    checked={selectedOrdersForProg.includes(orderNum)}
                                    onCheckedChange={() => toggleOrderSelection(orderNum)}
                                    disabled={isAlreadyInProg}
                                  />
                                  <label 
                                    htmlFor={`order-${orderNum}`}
                                    className="flex-1 text-xs font-mono cursor-pointer"
                                  >
                                    #{orderNum} {isAlreadyInProg && <span className="text-[9px] text-amber-500 ml-1">(Já Programado)</span>}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <Button type="submit" className="w-full bg-brand-accent text-black hover:bg-brand-accent/90">
                          GERAR PROGRAMAÇÃO
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Programmings List */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Programações Ativas</h3>
                    {programmings.length === 0 && (
                      <div className="text-center py-20 bg-brand-card border border-dashed border-brand-border rounded-lg">
                        <CalendarDays className="mx-auto text-gray-700 mb-4" size={48} />
                        <p className="text-gray-500 font-mono text-sm">Nenhuma programação cadastrada.</p>
                      </div>
                    )}
                    {programmings.map(prog => (
                      <Card key={prog.id} className="bg-brand-card border-brand-border overflow-hidden">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-bold">{prog.name}</h4>
                                <Badge variant="outline" className="bg-brand-accent/10 text-brand-accent border-brand-accent/20 text-[10px]">
                                  {prog.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">{prog.description || 'Sem descrição'}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-gray-500 hover:text-red-500"
                              onClick={() => setProgToDelete(prog.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Pedidos Incluídos</p>
                            <div className="flex flex-wrap gap-2">
                              {prog.orderNumbers.map(orderNum => (
                                <div key={orderNum} className="flex items-center gap-2 bg-brand-bg border border-brand-border px-3 py-1.5 rounded-md">
                                  <Package size={12} className="text-brand-accent" />
                                  <span className="text-xs font-mono font-bold">#{orderNum}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-6 pt-6 border-t border-brand-border flex justify-between items-center">
                            <div className="flex gap-4">
                              <div className="text-center">
                                <p className="text-[9px] uppercase text-gray-500 font-bold">Total Pares</p>
                                <p className="text-sm font-mono font-bold">
                                  {items.filter(i => i.programmingId === prog.id).reduce((acc, i) => acc + (i.quantity || 0), 0)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] uppercase text-gray-500 font-bold">Produzidos</p>
                                <p className="text-sm font-mono font-bold text-brand-accent">
                                  {items.filter(i => i.programmingId === prog.id && i.status === 'Produzido').reduce((acc, i) => acc + (i.quantity || 0), 0)}
                                </p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="border-brand-border hover:bg-white/5" onClick={() => {
                              setSearchQuery(prog.orderNumbers[0]); // Quick filter trick
                              setActiveTab('dashboard');
                            }}>
                              Ver Detalhes <ArrowRight size={14} className="ml-2" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="scanner" key="scanner">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="bg-brand-card border-brand-border shadow-2xl overflow-hidden">
                  <div className="h-2 bg-brand-accent scan-glow" />
                  <CardHeader className="text-center pt-10">
                    <div className="mx-auto bg-brand-accent/10 p-6 rounded-full w-fit mb-6 border border-brand-accent/20">
                      <Barcode size={48} className="text-brand-accent" />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tighter">TERMINAL DE LEITURA</CardTitle>
                    <CardDescription className="text-gray-500">Aguardando entrada do scanner de código de barras...</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-12 px-10">
                    <form onSubmit={handleScan} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="operator" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Operador Responsável</Label>
                        <Select value={operatorName} onValueChange={setOperatorName}>
                          <SelectTrigger className="bg-brand-bg border-brand-border font-mono h-12">
                            <SelectValue placeholder="SELECIONE O OPERADOR" />
                          </SelectTrigger>
                          <SelectContent className="bg-brand-card border-brand-border text-gray-200">
                            {operators.map(op => (
                              <SelectItem key={op.id} value={op.name} className="focus:bg-brand-accent focus:text-black">
                                {op.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="relative">
                        <Input 
                          autoFocus
                          placeholder="SCAN BARCODE" 
                          className="bg-brand-bg border-brand-border text-brand-accent text-center text-3xl py-12 font-mono tracking-[0.2em] focus-visible:ring-brand-accent/50 placeholder:text-gray-800"
                          value={scanInput}
                          onChange={e => setScanInput(e.target.value)}
                        />
                        <div className="absolute inset-y-0 left-0 w-1 bg-brand-accent/50" />
                        <div className="absolute inset-y-0 right-0 w-1 bg-brand-accent/50" />
                      </div>
                      <Button type="submit" className="w-full bg-white/5 hover:bg-white/10 text-gray-400 py-6 font-mono text-xs tracking-widest uppercase border border-white/5">
                        Confirmar Entrada Manual
                      </Button>
                    </form>

                    <div className="mt-12">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Histórico Recente</h4>
                        <Activity size={12} className="text-brand-accent animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        {items.filter(i => i.status === 'Produzido').sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 4).map((item, idx) => (
                          <motion.div 
                            key={item.id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex justify-between items-center bg-brand-bg/50 p-4 rounded-lg border border-brand-border group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-8 w-8 rounded bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                                <CheckCircle2 size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-sm font-mono tracking-tight">{item.orderNumber} <span className="text-gray-600 mx-1">/</span> {item.model}</p>
                                <p className="text-[10px] text-gray-500 font-mono uppercase">TAM: {item.size} • {item.barcode}</p>
                                <p className="text-[9px] text-brand-accent font-mono uppercase mt-1">OPERADOR: {item.producedBy}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-gray-600">
                              {new Date(item.updatedAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </motion.div>
                        ))}
                        {items.filter(i => i.status === 'Produzido').length === 0 && (
                          <div className="text-center py-8 text-gray-700 font-mono text-xs italic">
                            Nenhuma leitura registrada nesta sessão.
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            <TabsContent value="operators" key="operators">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="bg-brand-card border-brand-border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="text-brand-accent" size={20} />
                      Cadastrar Operador
                    </CardTitle>
                    <CardDescription>Adicione novos colaboradores para o controle de produção.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <form onSubmit={handleAddOperator} className="flex gap-3">
                      <Input 
                        placeholder="NOME COMPLETO" 
                        className="bg-brand-bg border-brand-border font-mono"
                        value={newOperatorName}
                        onChange={e => setNewOperatorName(e.target.value)}
                      />
                      <Button type="submit" className="bg-brand-accent text-black hover:bg-brand-accent/90 px-8">
                        ADICIONAR
                      </Button>
                    </form>

                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Operadores Ativos</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {operators.map(op => (
                          <div key={op.id} className="flex justify-between items-center p-4 bg-brand-bg/50 rounded-lg border border-brand-border group">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent font-bold text-xs">
                                {op.name.charAt(0)}
                              </div>
                              <span className="font-mono text-sm font-bold tracking-tight">{op.name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-gray-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveOperator(op.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                        {operators.length === 0 && (
                          <div className="text-center py-12 text-gray-700 font-mono text-xs italic border border-dashed border-brand-border rounded-lg">
                            Nenhum operador cadastrado.
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        {/* Print View (Hidden in UI, visible in print) */}
        <div className="hidden print:block">
          {selectedItem && (
            <div className="label-container">
              <div className="border-[6px] border-black w-[700px] text-black bg-white flex overflow-hidden">
                {/* Main Info Section */}
                <div className="flex-1 p-8 border-r-[6px] border-black flex flex-col justify-between">
                  <div>
                    <div className="mb-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Lote / Pedido</p>
                      <h2 className="text-4xl font-black font-mono">#{selectedItem.orderNumber}</h2>
                    </div>

                    <div className="mb-8">
                      <h1 className="text-4xl font-black tracking-tighter uppercase leading-none mb-2">{selectedItem.model}</h1>
                      <p className="text-2xl font-bold text-gray-800 uppercase">{selectedItem.color}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-y-2 border-black py-4 mb-8">
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase text-gray-500">Pedido</p>
                        <p className="font-mono font-bold text-lg">{new Date(selectedItem.orderDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-gray-500">Limite</p>
                        <p className="font-mono font-bold text-lg">{new Date(selectedItem.deadline).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center mt-auto">
                    <div className="bg-white">
                      <BarcodeComponent 
                        value={selectedItem.barcode} 
                        width={2.2} 
                        height={80} 
                        fontSize={12}
                        margin={0}
                      />
                    </div>
                    <p className="mt-2 text-[8px] font-mono font-bold text-gray-400 uppercase tracking-[0.5em]">Rastreamento Industrial</p>
                  </div>
                </div>

                {/* Large Side Section (Size & Quantity) */}
                <div className="w-56 bg-black text-white flex flex-col items-center justify-center p-6">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Sola - Qtd</p>
                  <div className="flex flex-col items-center w-full">
                    <h2 className="text-[110px] font-black font-mono leading-none">{selectedItem.size}</h2>
                    <div className="w-full border-t-[8px] border-white my-2"></div>
                    <h2 className="text-[110px] font-black font-mono leading-none">{selectedItem.quantity}</h2>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="bg-brand-card border-brand-border text-gray-200 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono tracking-tight">PRÉ-VISUALIZAÇÃO DA ETIQUETA</DialogTitle>
            <DialogDescription className="text-gray-500">
              Esta é uma representação fiel de como a etiqueta será impressa.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center p-4">
            {selectedItem && (
              <div className="border-[4px] border-black w-full max-w-[700px] text-black bg-white flex overflow-hidden rounded-sm shadow-2xl">
                {/* Main Info Section */}
                <div className="flex-1 p-6 border-r-[4px] border-black flex flex-col justify-between bg-white">
                  <div>
                    <div className="mb-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5">Lote / Pedido</p>
                      <h2 className="text-3xl font-black font-mono leading-none">#{selectedItem.orderNumber}</h2>
                    </div>

                    <div className="mb-6">
                      <h1 className="text-3xl font-black tracking-tighter uppercase leading-none mb-1">{selectedItem.model}</h1>
                      <p className="text-xl font-bold text-gray-700 uppercase">{selectedItem.color}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-y border-black/20 py-3 mb-6">
                      <div className="text-left">
                        <p className="text-[8px] font-bold uppercase text-gray-400">Pedido</p>
                        <p className="font-mono font-bold text-sm">{new Date(selectedItem.orderDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold uppercase text-gray-400">Limite</p>
                        <p className="font-mono font-bold text-sm">{new Date(selectedItem.deadline).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center mt-auto">
                    <div className="bg-white">
                      <BarcodeComponent 
                        value={selectedItem.barcode} 
                        width={1.8} 
                        height={60} 
                        fontSize={10}
                        margin={0}
                      />
                    </div>
                    <p className="mt-2 text-[7px] font-mono font-bold text-gray-400 uppercase tracking-[0.4em]">Rastreamento Industrial</p>
                  </div>
                </div>

                {/* Large Side Section (Size & Quantity) */}
                <div className="w-40 bg-black text-white flex flex-col items-center justify-center p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Sola - Qtd</p>
                  <div className="flex flex-col items-center w-full">
                    <h2 className="text-6xl font-black font-mono leading-none">{selectedItem.size}</h2>
                    <div className="w-full border-t-[4px] border-white my-1"></div>
                    <h2 className="text-6xl font-black font-mono leading-none">{selectedItem.quantity}</h2>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="hover:bg-white/5" onClick={() => setSelectedItem(null)}>Fechar</Button>
            <Button className="bg-brand-accent text-black hover:bg-brand-accent/90" onClick={handlePrint}>
              <Printer className="mr-2" size={16} /> Imprimir Etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <DialogContent className="bg-brand-card border-brand-border text-gray-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-mono">
              <Trash2 size={20} /> DELETAR_LOTE
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Atenção: Esta operação removerá permanentemente o lote <strong>{orderToDelete}</strong> e todos os registros associados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="hover:bg-white/5" onClick={() => setOrderToDelete(null)}>Abortar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteOrder}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!progToDelete} onOpenChange={(open) => !open && setProgToDelete(null)}>
        <DialogContent className="bg-brand-card border-brand-border text-gray-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500 font-mono">
              <Trash2 size={20} /> DELETAR_PROGRAMAÇÃO
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Deseja realmente excluir esta programação? Os pedidos não serão excluídos, apenas o agrupamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="hover:bg-white/5" onClick={() => setProgToDelete(null)}>Abortar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteProgramming}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster theme="dark" position="top-right" />
    </div>
  );
}
