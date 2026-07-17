'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  Edit, 
  TrendingUp, 
  Sliders, 
  AlertTriangle,
  Layers
} from 'lucide-react';

interface MarginFloor {
  id: string;
  category: string;
  min_margin: number;
}

interface OrgSettings {
  id: string;
  confidence_threshold: number;
  margin_floors: MarginFloor[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_of_goods: number;
  current_price: number;
  is_active: boolean;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Settings state
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [confidenceInput, setConfidenceInput] = useState<number>(80);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Margin floor form state
  const [newCategory, setNewCategory] = useState('');
  const [newMinMargin, setNewMinMargin] = useState<number>(20);
  const [isAddingFloor, setIsAddingFloor] = useState(false);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [productsSearch, setProductsSearch] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Product form state
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('100');
  const [prodError, setProdError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchProducts();
  }, [productsPage, productsSearch]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
      setConfidenceInput(Math.round(res.data.confidence_threshold * 100));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch settings');
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          page: productsPage,
          limit: 10,
          search: productsSearch || undefined,
        },
      });
      setProducts(res.data.products);
      setProductsTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to fetch products');
    } finally {
      setProductsLoading(false);
    }
  };

  // Confidence settings action
  const handleSaveSettings = async () => {
    setIsUpdatingSettings(true);
    try {
      await api.patch('/admin/settings', {
        confidence_threshold: confidenceInput / 100,
      });
      toast.success('Confidence threshold updated successfully.');
      await fetchSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update settings');
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Margin floors actions
  const handleAddMarginFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setIsAddingFloor(true);
    try {
      await api.post('/admin/settings/margin-floors', {
        category: newCategory.trim(),
        min_margin: newMinMargin / 100,
      });
      setNewCategory('');
      setNewMinMargin(20);
      toast.success(`Margin floor for "${newCategory}" added successfully.`);
      await fetchSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add margin floor');
    } finally {
      setIsAddingFloor(false);
    }
  };

  const handleDeleteMarginFloor = async (floorId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the margin floor rule for "${categoryName}"?`)) return;
    try {
      await api.delete(`/admin/settings/margin-floors/${floorId}`);
      toast.success(`Margin floor for "${categoryName}" removed.`);
      await fetchSettings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete margin floor');
    }
  };

  // Product CRUD actions
  const handleOpenAddProduct = () => {
    setProdName('');
    setProdSku('');
    setProdCategory('');
    setProdCost('');
    setProdPrice('');
    setProdStock('100');
    setProdError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError(null);
    setIsSavingProduct(true);
    try {
      await api.post('/products', {
        name: prodName,
        sku: prodSku.toUpperCase(),
        category: prodCategory,
        cost_of_goods: parseFloat(prodCost),
        current_price: parseFloat(prodPrice),
        initial_stock: parseInt(prodStock),
      });
      setIsAddModalOpen(false);
      toast.success(`Product "${prodName}" created successfully.`);
      fetchProducts();
    } catch (err: any) {
      setProdError(err.response?.data?.error || err.response?.data?.details?.[0] || 'Failed to create product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleOpenEditProduct = (prod: Product) => {
    setActiveProduct(prod);
    setProdName(prod.name);
    setProdCategory(prod.category);
    setProdCost(prod.cost_of_goods.toString());
    setProdPrice(prod.current_price.toString());
    setProdError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;
    setProdError(null);
    setIsSavingProduct(true);
    try {
      await api.patch(`/products/${activeProduct.id}`, {
        name: prodName,
        category: prodCategory,
        cost_of_goods: parseFloat(prodCost),
        current_price: parseFloat(prodPrice),
      });
      setIsEditModalOpen(false);
      toast.success(`Product "${prodName}" updated successfully.`);
      fetchProducts();
    } catch (err: any) {
      setProdError(err.response?.data?.error || err.response?.data?.details?.[0] || 'Failed to update product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (!confirm(`Are you sure you want to archive product "${prod.name}" (SKU: ${prod.sku})? This soft-deletes it from active catalog grids.`)) return;
    try {
      await api.delete(`/products/${prod.id}`);
      toast.success(`Product "${prod.name}" archived successfully.`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to archive product');
    }
  };

  return (
    <div className="font-sans min-h-screen bg-neutral-50 p-6 md:p-8">
      
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.push('/')}
              className="p-2 bg-white rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Admin Control Panel</h1>
              <p className="text-xs font-medium text-neutral-400 mt-0.5">Manage pricing thresholds, margin floors, and inventory catalogs</p>
            </div>
          </div>
          
          {/* Section Navigation Tabs */}
          <div className="flex bg-neutral-200/60 p-1 rounded-xl border border-neutral-200/30 self-start md:self-auto select-none">
            <button className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg text-sm font-bold text-neutral-900 shadow-sm transition-all">
              <Settings className="h-4 w-4" />
              <span>Settings & Catalog</span>
            </button>
            <button 
              onClick={() => router.push('/admin/users')}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <Users className="h-4 w-4" />
              <span>Team Members</span>
            </button>
            <button 
              onClick={() => router.push('/audit')}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Audit Trail</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start mb-8">
          
          {/* Left Block: Confidence Config */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-4 border-b border-neutral-100 pb-3">
                <Sliders className="h-5 w-5 text-neutral-800" />
                <h2 className="text-base font-bold text-neutral-900">AI Confidence Gate</h2>
              </div>
              <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                Recommendations with a confidence score equal to or exceeding this threshold will automatically execute on your storefront. Lower-confidence items trigger Human-in-the-Loop review.
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">THRESHOLD LEVEL</span>
                  <span className="text-lg font-black text-neutral-900">{confidenceInput}%</span>
                </div>
                <div className="flex items-center space-x-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={confidenceInput}
                    onChange={(e) => setConfidenceInput(Number(e.target.value))}
                    className="flex-1 accent-neutral-950 h-2 bg-neutral-100 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={confidenceInput}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value)));
                      setConfidenceInput(val);
                    }}
                    className="w-16 p-1.5 border border-neutral-200 rounded-lg text-center text-sm font-bold text-neutral-900 bg-neutral-50 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={isUpdatingSettings}
                className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isUpdatingSettings ? 'Saving...' : 'Save Threshold'}
              </button>
            </div>

            {/* Margin Floor List */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-4 border-b border-neutral-100 pb-3">
                <Layers className="h-5 w-5 text-neutral-800" />
                <h2 className="text-base font-bold text-neutral-900">Margin Guard Floors</h2>
              </div>
              <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                Define the absolute minimum profit margin floor per category. Recommended prices yielding profit margins below this floor will be immediately blocked.
              </p>

              {/* Add Floor Inline form */}
              <form onSubmit={handleAddMarginFloor} className="space-y-4 mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200/50">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CATEGORY NAME</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Footwear"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2 text-xs border border-neutral-200 rounded-lg bg-white outline-none text-neutral-900"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">MIN MARGIN</label>
                    <span className="text-xs font-black text-neutral-900">{newMinMargin}%</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={newMinMargin}
                      onChange={(e) => setNewMinMargin(Number(e.target.value))}
                      className="flex-1 accent-neutral-950 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                    <input 
                      type="number"
                      min="0"
                      max="100"
                      value={newMinMargin}
                      onChange={(e) => setNewMinMargin(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-12 p-1 border border-neutral-200 rounded-lg text-center text-xs font-bold text-neutral-900 bg-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isAddingFloor || !newCategory.trim()}
                  className="w-full flex items-center justify-center space-x-1 py-1.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Margin Rule</span>
                </button>
              </form>

              {/* Floors list table */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider block mb-2">ACTIVE RULES</span>
                {!settings || settings.margin_floors.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic text-center py-2">No category margin constraints defined</p>
                ) : (
                  <div className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                    {settings.margin_floors.map((floor) => (
                      <div key={floor.id} className="flex justify-between items-center py-2 text-xs">
                        <div>
                          <strong className="text-neutral-800">{floor.category}</strong>
                          <span className="text-neutral-400 font-medium ml-2">Min Margin: {(floor.min_margin * 100).toFixed(0)}%</span>
                        </div>
                        <button
                          onClick={() => handleDeleteMarginFloor(floor.id, floor.category)}
                          className="p-1 hover:text-red-600 text-neutral-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Block: Product CRUD Catalog */}
          <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-neutral-100 pb-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-neutral-800" />
                <h2 className="text-base font-bold text-neutral-900">Catalog Product Management</h2>
              </div>
              <button
                onClick={handleOpenAddProduct}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-950 hover:bg-neutral-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Catalog search bar */}
            <div className="mb-4">
              <input 
                type="text"
                placeholder="Filter catalog products by name or SKU..."
                value={productsSearch}
                onChange={(e) => { setProductsSearch(e.target.value); setProductsPage(1); }}
                className="w-full p-2 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
              />
            </div>

            {/* Products grid table */}
            {productsLoading ? (
              <div className="py-12 text-center text-xs text-neutral-400">Loading catalog items...</div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-neutral-200 rounded-xl">
                <p className="text-xs text-neutral-400 font-bold">No catalog products found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-2">SKU Code</th>
                      <th className="py-2.5 px-2">Product Title</th>
                      <th className="py-2.5 px-2">Category</th>
                      <th className="py-2.5 px-2 text-right">Cost</th>
                      <th className="py-2.5 px-2 text-right">Price</th>
                      <th className="py-2.5 px-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-2 font-mono font-bold text-neutral-950">{prod.sku}</td>
                        <td className="py-3 px-2 font-medium text-neutral-800">{prod.name}</td>
                        <td className="py-3 px-2 text-neutral-400">{prod.category}</td>
                        <td className="py-3 px-2 text-right text-neutral-800 font-medium">${prod.cost_of_goods.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-neutral-800 font-bold">${prod.current_price.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1 hover:text-neutral-900 text-neutral-400 transition-colors"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod)}
                              className="p-1 hover:text-red-600 text-neutral-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination footer block */}
                {productsTotalPages > 1 && (
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-100 text-xs">
                    <button
                      disabled={productsPage === 1}
                      onClick={() => setProductsPage(prev => Math.max(1, prev - 1))}
                      className="px-2.5 py-1 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-neutral-400">Page <strong>{productsPage}</strong> of {productsTotalPages}</span>
                    <button
                      disabled={productsPage === productsTotalPages}
                      onClick={() => setProductsPage(prev => Math.min(productsTotalPages, prev + 1))}
                      className="px-2.5 py-1 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: ADD PRODUCT */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 mb-4">Add Product to Catalog</h3>
            
            {prodError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                {prodError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">PRODUCT NAME</label>
                <input 
                  type="text" 
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Sony WH-1000XM5"
                  className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">SKU CODE</label>
                  <input 
                    type="text" 
                    required
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="e.g. SONY-WH1000"
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CATEGORY</label>
                  <select
                    required
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  >
                    <option value="">Select Category</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Clothing">Clothing</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Sports & Outdoors">Sports & Outdoors</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">COST OF GOODS ($)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={prodCost}
                    onChange={(e) => setProdCost(e.target.value)}
                    placeholder="150.00"
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CURRENT PRICE ($)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="299.99"
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">INITIAL STOCK</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    placeholder="100"
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSavingProduct ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT PRODUCT */}
      {/* ============================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200">
            <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 mb-4">Edit Product: <span className="font-mono text-xs">{activeProduct?.sku}</span></h3>

            {prodError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                {prodError}
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">PRODUCT NAME</label>
                <input 
                  type="text" 
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CATEGORY</label>
                <select
                  required
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Clothing">Clothing</option>
                  <option value="Footwear">Footwear</option>
                  <option value="Sports & Outdoors">Sports & Outdoors</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">COST OF GOODS ($)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={prodCost}
                    onChange={(e) => setProdCost(e.target.value)}
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-700 uppercase tracking-wider">CURRENT PRICE ($)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full p-2.5 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white outline-none text-neutral-900"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSavingProduct ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
