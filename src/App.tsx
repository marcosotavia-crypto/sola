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
import { Plus, Package, Barcode, CheckCircle2, Search, Printer, LayoutDashboard, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeComponent from 'react-barcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FootwearItem } from './types';
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<FootwearItem | null>(null);
  
  // Form states
  const [orderNumber, setOrderNumber] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
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
  
  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

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
      toast.error("Erro ao carregar dados em tempo real");
    });

    return () => unsubscribe();
  }, []);

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();

    const activeSizes = sizeQuantities.filter(sq => sq.quantity > 0);

    if (!orderNumber || !model || !color || activeSizes.length === 0) {
      toast.error('Preencha todos os campos e pelo menos uma quantidade');
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
        pairsPerLabel
      });
      toast.success('Pedido cadastrado com sucesso!');
      setOrderNumber('');
      setModel('');
      setColor('');
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
      const success = await productionService.updateStatus(item.barcode, newStatus);
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

    try {
      const success = await productionService.updateStatus(scanInput, 'Produzido');
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
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-[#141414]">
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4 sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#141414] text-white p-2 rounded-lg">
              <Package size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FootwearPro</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input 
                placeholder="Buscar pedido ou código..." 
                className="pl-10 w-64 bg-gray-50 border-none focus-visible:ring-1 focus-visible:ring-[#141414]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 print:p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 print:hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-white border border-[#E5E5E5] p-1">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-[#141414] data-[state=active]:text-white">
                <LayoutDashboard className="mr-2" size={16} /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="new-order" className="data-[state=active]:bg-[#141414] data-[state=active]:text-white">
                <Plus className="mr-2" size={16} /> Novo Pedido
              </TabsTrigger>
              <TabsTrigger value="scanner" className="data-[state=active]:bg-[#141414] data-[state=active]:text-white">
                <Barcode className="mr-2" size={16} /> Baixa (Bipar)
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-mono">Pares Produzidos</p>
                <p className="text-2xl font-bold font-mono">{(stats.produced || 0)}/{(stats.total || 0)}</p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <TabsContent value="dashboard" key="dashboard">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
              >
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="uppercase text-[10px] tracking-widest font-bold">Pares Pendentes</CardDescription>
                    <CardTitle className="text-4xl font-mono">{(stats.pending || 0)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="uppercase text-[10px] tracking-widest font-bold">Pares Produzidos</CardDescription>
                    <CardTitle className="text-4xl font-mono text-green-600">{(stats.produced || 0)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="uppercase text-[10px] tracking-widest font-bold">Eficiência</CardDescription>
                    <CardTitle className="text-4xl font-mono">
                      {(stats.total > 0 && !isNaN(stats.produced)) ? Math.round((stats.produced / stats.total) * 100) : 0}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              </motion.div>

              <div className="space-y-8">
                {(Object.entries(groupedItems) as [string, FootwearItem[]][]).sort((a,b) => (b[1][0].createdAt || 0) - (a[1][0].createdAt || 0)).map(([orderNum, orderItems]) => (
                  <Card key={orderNum} className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <CardTitle className="text-lg">Pedido: {orderNum}</CardTitle>
                          <CardDescription>{orderItems[0].model} - {orderItems[0].color}</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white">
                          {orderItems.filter(i => i.status === 'Produzido').reduce((a, b) => a + (b.quantity || 0), 0)} / {orderItems.reduce((a, b) => a + (b.quantity || 0), 0)} Pares
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handlePrintAll(orderItems)}>
                          <Printer size={14} className="mr-2" /> Etiquetas
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setOrderToDelete(orderNum)}>
                          <X size={14} className="mr-2" /> Excluir
                        </Button>
                      </div>
                    </CardHeader>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-gray-100">
                          <TableHead className="font-mono text-[11px] uppercase italic opacity-60">Tamanho</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase italic opacity-60">Quantidade</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase italic opacity-60">Código de Barras</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase italic opacity-60">Status</TableHead>
                          <TableHead className="font-mono text-[11px] uppercase italic opacity-60 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.sort((a,b) => a.size.localeCompare(b.size)).map((item) => (
                          <TableRow key={item.id} className="group hover:bg-gray-50 transition-colors">
                            <TableCell className="font-mono font-bold">{item.size}</TableCell>
                            <TableCell className="font-mono">{(item.quantity || 0)} pares</TableCell>
                            <TableCell>
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{item.barcode}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.status === 'Produzido' ? 'default' : 'secondary'} className={item.status === 'Produzido' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-none' : 'bg-orange-100 text-orange-700 hover:bg-orange-100 border-none'}>
                                {item.status === 'Produzido' ? <CheckCircle2 size={12} className="mr-1" /> : null}
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`h-8 w-8 ${item.status === 'Produzido' ? 'text-orange-500 hover:text-orange-600' : 'text-green-500 hover:text-green-600'}`}
                                  onClick={() => handleManualStatusToggle(item)}
                                  title={item.status === 'Produzido' ? 'Marcar como Pendente' : 'Marcar como Produzido'}
                                >
                                  {item.status === 'Produzido' ? <X size={14} /> : <CheckCircle2 size={14} />}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-gray-400 hover:text-[#141414]"
                                  onClick={() => setSelectedItem(item)}
                                  title="Imprimir Etiqueta"
                                >
                                  <Printer size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ))}

                {items.length === 0 && (
                  <Card className="border-none shadow-sm p-12 text-center text-gray-400">
                    Nenhum pedido cadastrado. Vá em "Novo Pedido" para começar.
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="new-order" key="new-order">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card className="max-w-3xl mx-auto border-none shadow-sm">
                  <CardHeader>
                    <CardTitle>Cadastrar Novo Pedido</CardTitle>
                    <CardDescription>Insira os detalhes do pedido e defina a quantidade de pares por tamanho.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateOrder} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="orderNum">Número do Pedido</Label>
                          <Input id="orderNum" placeholder="Ex: PED1001" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model">Modelo</Label>
                          <Input id="model" placeholder="Ex: Tênis Casual" value={model} onChange={e => setModel(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="color">Cor</Label>
                          <Input id="color" placeholder="Ex: Preto" value={color} onChange={e => setColor(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pairsPerLabel">Pares por Etiqueta</Label>
                          <Input 
                            id="pairsPerLabel" 
                            type="number" 
                            min="1" 
                            max="100" 
                            value={pairsPerLabel || ''} 
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '') {
                                setPairsPerLabel(0);
                              } else {
                                setPairsPerLabel(parseInt(val) || 0);
                              }
                            }} 
                          />
                          <p className="text-[10px] text-gray-500 italic">Define o agrupamento máximo por etiqueta.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-lg font-bold">Grade de Produção (Quantidade por Tamanho)</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                          {sizeQuantities.map((sq) => (
                            <div key={sq.size} className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <span className="font-mono font-bold text-gray-500">{sq.size}</span>
                              <Input 
                                type="number" 
                                className="text-center font-bold bg-white" 
                                value={sq.quantity || ''} 
                                onChange={(e) => updateSizeQuantity(sq.size, parseInt(e.target.value) || 0)}
                              />
                            </div>
                          ))}
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-full flex flex-col gap-1 border-dashed"
                            onClick={() => {
                              const nextSize = (parseInt(sizeQuantities[sizeQuantities.length - 1].size) + 1).toString();
                              setSizeQuantities([...sizeQuantities, { size: nextSize, quantity: 0 }]);
                            }}
                          >
                            <Plus size={16} />
                            <span className="text-[10px] uppercase font-bold">Add Tam</span>
                          </Button>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button type="submit" className="w-full bg-[#141414] hover:bg-[#2a2a2a] text-white py-8 text-lg font-bold shadow-lg shadow-black/10">
                          Gerar Pedido e {sizeQuantities.reduce((a, b) => a + (b.quantity || 0), 0)} Etiquetas
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="scanner" key="scanner">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-xl mx-auto"
              >
                <Card className="border-none shadow-sm bg-[#141414] text-white">
                  <CardHeader className="text-center">
                    <div className="mx-auto bg-white/10 p-4 rounded-full w-fit mb-4">
                      <Barcode size={48} />
                    </div>
                    <CardTitle className="text-2xl">Simulador de Leitor</CardTitle>
                    <CardDescription className="text-gray-400">Bipe o código de barras do par para registrar a produção.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleScan} className="space-y-4">
                      <Input 
                        autoFocus
                        placeholder="Aguardando leitura..." 
                        className="bg-white/5 border-white/10 text-white text-center text-xl py-8 focus-visible:ring-white/20"
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                      />
                      <Button type="submit" className="w-full bg-white text-[#141414] hover:bg-gray-200 py-6 font-bold">
                        Confirmar Baixa Manual
                      </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/10">
                      <h4 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-4">Últimas Leituras</h4>
                      <div className="space-y-2">
                        {items.filter(i => i.status === 'Produzido').sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 3).map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <div>
                              <p className="font-bold text-sm">{item.orderNumber} - {item.model}</p>
                              <p className="text-xs text-gray-400">Tam: {item.size} | {item.barcode}</p>
                            </div>
                            <CheckCircle2 className="text-green-400" size={20} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        {/* Print View (Hidden in UI, visible in print) */}
        <div className="hidden print:block text-center p-8">
          {selectedItem && (
            <div className="border-2 border-black p-4 inline-block">
              <h2 className="text-xl font-bold mb-2">{selectedItem.model} - {selectedItem.color}</h2>
              <p className="text-lg mb-4">Tamanho: {selectedItem.size} | Pedido: {selectedItem.orderNumber}</p>
              <BarcodeComponent value={selectedItem.barcode} width={2} height={100} />
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etiqueta de Produção</DialogTitle>
            <DialogDescription>
              Visualize e imprima a etiqueta para este item.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-gray-100">
            {selectedItem && (
              <>
                <div className="text-center mb-6">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">{selectedItem.orderNumber}</p>
                  <h3 className="text-xl font-bold">{selectedItem.model}</h3>
                  <p className="text-sm text-gray-600">{selectedItem.color} | Tam: {selectedItem.size}</p>
                </div>
                <div className="bg-white p-4 rounded border border-gray-200">
                  <BarcodeComponent 
                    value={selectedItem.barcode} 
                    width={1.5} 
                    height={60} 
                    fontSize={12}
                    background="#ffffff"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Fechar</Button>
            <Button className="bg-[#141414] text-white" onClick={handlePrint}>
              <Printer className="mr-2" size={16} /> Imprimir Etiqueta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={20} /> Excluir Pedido
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o pedido <strong>{orderToDelete}</strong>? Esta ação removerá permanentemente todos os itens e etiquetas associados e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setOrderToDelete(null)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteOrder}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" />
    </div>
  );
}

