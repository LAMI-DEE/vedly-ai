"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Search, Plus, Pencil, Trash2, X, AlertTriangle, Loader2, Package, Download, Info, Scissors, Bot, Truck } from "lucide-react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store";
import { isAxiosError } from "axios";

// 🚀 STRICT TYPES
export type ProductType = 'PHYSICAL' | 'DROPSHIP' | 'SERVICE';

interface PackagingRule {
  id?: string;
  packaging_name: string;
  multiplier: number;
  cost_price: string;
  selling_price: string;
}

interface InventoryItem {
  id: string;
  item_name: string;
  base_unit_name: string;
  total_base_stock: number | null; 
  base_cost_price: string | number;
  base_selling_price: string | number;
  product_type: ProductType; 
  packaging_rules: PackagingRule[];
  needs_web_setup?: boolean;
}

interface FormPackagingRule {
  name: string;
  multiplier: string;
  cost: string;
  selling: string;
}

interface PendingProduct {
  id: string;
  item_name: string;
  product_type: ProductType;
}

const formatCurrency = (amount: string | number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(amount || 0));
};

export default function InventoryPage() {
  const { business } = useAuthStore();
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // States
  const [productType, setProductType] = useState<ProductType>('PHYSICAL');
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [formData, setFormData] = useState({
    itemName: "", baseUnitName: "", totalBaseStock: "", baseCostPrice: "", baseSellingPrice: ""
  });
  
  const [packagingRules, setPackagingRules] = useState<FormPackagingRule[]>([]);

  const fetchInventory = async () => {
    if (!business?.id) return;
    try {
      const res = await api.get(`/inventory/list?businessId=${business.id}`);
      setInventory(res.data.data);
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingProducts = async () => {
    if (!business?.id) return;
    try {
      const res = await api.get(`/inventory/pending-setup?businessId=${business.id}`);
      if (res.data.data && res.data.data.length > 0) {
        setPendingProducts(res.data.data);
        setShowPendingModal(true);
      } else {
        setPendingProducts([]);
        setShowPendingModal(false);
      }
    } catch (error) {
      console.error("Failed to fetch pending products", error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter(row => row.trim().length > 0);
      
      const importedItems = rows.slice(1).map(row => {
        const cols = row.split(',');
        return {
          itemName: cols[0]?.trim(),
          baseUnitName: cols[1]?.trim() || 'unit',
          totalBaseStock: parseInt(cols[2]?.trim() || '0')
        };
      }).filter(item => item.itemName); 

      try {
        await api.post("/inventory/import", { businessId: business?.id, items: importedItems });
        fetchInventory(); 
      } catch (err) {
        console.error("Import failed", err);
        setError("Failed to import CSV.");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => { 
    if (business?.id) {
      fetchInventory();
      fetchPendingProducts(); 
    }
  }, [business?.id]);

  const filteredInventory = inventory.filter(item => 
    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.base_unit_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🚀 NEW: Smart Toggle Logic to prevent Sticky State
  const handleProductTypeChange = (newType: ProductType) => {
    setFormData(prev => {
      let newUnit = prev.baseUnitName;
      let newCost = prev.baseCostPrice;

      // If switching OUT of Service back to Physical/Dropship
      if (productType === 'SERVICE' && newType !== 'SERVICE') {
        if (newUnit === 'session') newUnit = ''; // Clean up the sticky unit
        if (newCost === '0') newCost = '';       // Clean up the sticky zero cost
      }

      // If switching INTO Service
      if (newType === 'SERVICE') {
        if (!newUnit) newUnit = 'session';       // Auto-suggest session only if empty
        newCost = '0';                           // Force cost to 0
      }

      return { ...prev, baseUnitName: newUnit, baseCostPrice: newCost };
    });
    setProductType(newType);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setProductType('PHYSICAL');
    setFormData({ itemName: "", baseUnitName: "", totalBaseStock: "", baseCostPrice: "", baseSellingPrice: "" });
    setPackagingRules([{ name: "", multiplier: "", cost: "", selling: "" }]);
    setError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setProductType(item.product_type || 'PHYSICAL');
    
    setFormData({
      itemName: item.item_name, 
      baseUnitName: item.base_unit_name, 
      totalBaseStock: item.total_base_stock !== null ? item.total_base_stock.toString() : "",
      baseCostPrice: item.base_cost_price.toString(), 
      baseSellingPrice: item.base_selling_price.toString()
    });
    
    const existingRules = item.packaging_rules.map(rule => ({
      name: rule.packaging_name, multiplier: rule.multiplier.toString(), 
      cost: rule.cost_price.toString(), selling: rule.selling_price.toString()
    }));
    setPackagingRules(existingRules);
    setError("");
    setIsModalOpen(true);
  };

  const confirmDelete = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const addPackagingRule = () => {
    setPackagingRules([...packagingRules, { name: "", multiplier: "", cost: "", selling: "" }]);
  };

  const removePackagingRule = (index: number) => {
    const newRules = [...packagingRules];
    newRules.splice(index, 1);
    setPackagingRules(newRules);
  };

  const updatePackagingRule = (index: number, field: keyof FormPackagingRule, value: string) => {
    const newRules = [...packagingRules];
    newRules[index] = { ...newRules[index], [field]: value }; 
    setPackagingRules(newRules);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (Number(formData.baseSellingPrice) <= 0) {
      setError("Please at least set a valid Selling Price greater than ₦0 before saving.");
      setIsSubmitting(false);
      return;
    }

    const validRules = packagingRules.filter(r => r.name && r.multiplier);
    const finalStock = productType === 'PHYSICAL' ? Number(formData.totalBaseStock) : null;
    const finalCostPrice = productType === 'SERVICE' ? 0 : Number(formData.baseCostPrice);
    
    try {
      if (editingItem) {
        await api.put("/inventory/edit", {
          productId: editingItem.id, businessId: business?.id,
          itemName: formData.itemName, baseUnitName: formData.baseUnitName, 
          totalBaseStock: finalStock,
          baseCostPrice: finalCostPrice, baseSellingPrice: Number(formData.baseSellingPrice),
          productType: productType,
          packagingRules: validRules 
        });
        
        setPendingProducts(prev => prev.filter(p => p.id !== editingItem.id));
        if (pendingProducts.length <= 1) setShowPendingModal(false);

      } else {
        await api.post("/inventory/add", {
          businessId: business?.id,
          itemName: formData.itemName, baseUnitName: formData.baseUnitName, 
          totalBaseStock: finalStock,
          baseCostPrice: finalCostPrice, baseSellingPrice: Number(formData.baseSellingPrice),
          productType: productType,
          packagingRules: validRules 
        });
      }
      setIsModalOpen(false);
      fetchInventory(); 
      fetchPendingProducts(); 
    } catch (err) {
      if (isAxiosError(err)) setError(err.response?.data?.message || "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/inventory/remove?productId=${itemToDelete.id}&businessId=${business?.id}`);
      setIsDeleteModalOpen(false);
      fetchInventory();
    } catch (error) {
      console.error("Failed to delete", error);
    } finally {
      setIsSubmitting(false);
      setItemToDelete(null);
    }
  };

  const container: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const row: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="space-y-6 pb-10">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory & Services</h1>
          <p className="text-sm text-slate-500 mt-1">Manage physical products, dropship items, and services.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-4 h-4 text-slate-400" /></div>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search items..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" />
          </div>
          
          <label className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            <Download className="w-4 h-4 rotate-180" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          <button onClick={openAddModal} className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Retail (Single)</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total Stock</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Bulk Packages</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            
            {isLoading ? (
              <tbody><tr><td colSpan={5} className="py-10 text-center text-slate-500">Loading inventory...</td></tr></tbody>
            ) : filteredInventory.length === 0 ? (
              <tbody><tr><td colSpan={5} className="py-10 text-center text-slate-500">No items match your search.</td></tr></tbody>
            ) : (
              <motion.tbody variants={container} initial="hidden" animate="show" className="divide-y divide-slate-100">
                {filteredInventory.map((item) => (
                  <motion.tr variants={row} key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-xs uppercase border border-emerald-100 flex-shrink-0">
                          {item.item_name.substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {item.item_name}
                            {item.product_type === 'DROPSHIP' && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-blue-100 text-blue-700 flex items-center gap-1"><Truck className="w-3 h-3"/> Dropship</span>}
                            {item.product_type === 'SERVICE' && <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 flex items-center gap-1"><Scissors className="w-3 h-3"/> Service</span>}
                          </span>
                          <span className="text-xs text-slate-500">Base Unit: {item.base_unit_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(item.base_selling_price)} <span className="font-normal text-xs text-slate-500">sell</span></span>
                        <span className="text-xs text-slate-500">{formatCurrency(item.base_cost_price)} cost</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.product_type === 'PHYSICAL' ? (
                        <>
                          <span className="text-sm font-bold text-slate-900">{item.total_base_stock}</span>
                          <span className="text-xs text-slate-500 ml-1">{item.base_unit_name}s</span>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-lg leading-none">∞</span>
                          <span className="text-xs font-medium">Infinite</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        {item.packaging_rules.length > 0 ? (
                          item.packaging_rules.map((rule) => (
                            <span key={rule.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
                              <Package className="w-3 h-3 mr-1.5" />
                              <strong className="font-bold mr-1">1 {rule.packaging_name}</strong> = {rule.multiplier} {item.base_unit_name}s ({formatCurrency(rule.selling_price)})
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No bulk packages</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            )}
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 sm:p-8 border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">{editingItem ? "Edit Item" : "Add New Item"}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

              <form onSubmit={handleSave} className="space-y-6">
                
                {/* The 3-Way Product Type Toggle Using the Smart Function */}
                <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1">
                  <button type="button" onClick={() => handleProductTypeChange('PHYSICAL')} className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${productType === 'PHYSICAL' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Package className="w-4 h-4" /> Physical Item
                  </button>
                  <button type="button" onClick={() => handleProductTypeChange('DROPSHIP')} className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${productType === 'DROPSHIP' ? 'bg-white text-blue-700 shadow-sm border border-blue-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Truck className="w-4 h-4" /> Dropship
                  </button>
                  <button type="button" onClick={() => handleProductTypeChange('SERVICE')} className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${productType === 'SERVICE' ? 'bg-white text-purple-700 shadow-sm border border-purple-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Scissors className="w-4 h-4" /> Service
                  </button>
                </div>

                {/* Core Item Details */}
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-emerald-600" /> Core Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                      <input required value={formData.itemName} onChange={(e)=>setFormData({...formData, itemName: e.target.value})} type="text" placeholder="e.g., Bridal Makeup, Oud Perfume, Milo 60g" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 🚀 NEW: Quick-Select UX for Base Unit */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Base Unit</label>
                        <input required value={formData.baseUnitName} onChange={(e)=>setFormData({...formData, baseUnitName: e.target.value})} type="text" placeholder={productType === 'SERVICE' ? "e.g., session, gig, hour" : "e.g., piece, bottle, yard"} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(productType === 'SERVICE' ? ['session', 'hour', 'gig'] : productType === 'DROPSHIP' ? ['piece', 'pair', 'item'] : ['piece', 'bottle', 'carton']).map(unit => (
                            <button 
                              key={unit}
                              type="button"
                              onClick={() => setFormData({...formData, baseUnitName: unit})}
                              className="text-[10px] px-2 py-1 bg-slate-200 text-slate-600 rounded-md font-medium hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Conditional Render for Stock */}
                      {productType === 'PHYSICAL' ? (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Total Stock in Shop</label>
                          <input required value={formData.totalBaseStock} onChange={(e)=>setFormData({...formData, totalBaseStock: e.target.value})} type="number" placeholder="0" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                      ) : productType === 'DROPSHIP' ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2 h-full">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-blue-800 leading-tight">
                            <strong>Infinite Stock:</strong> You buy this from suppliers when customers order. Vedly won&apos;t warn you about low stock.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 flex items-start gap-2 h-full">
                          <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-purple-800 leading-tight">
                            <strong>Service:</strong> Track your skill-based work eg hair-dresser, nail-dressing, Make-up artistry e.t.c. Services have infinite availability.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                    {/* Hide Cost Price completely if it is a Service */}
                    {productType !== 'SERVICE' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Cost (1 Single Unit)</label>
                        <input value={formData.baseCostPrice} onChange={(e)=>setFormData({...formData, baseCostPrice: e.target.value})} type="number" placeholder="₦0.00" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    )}
                    {/* Make Selling Price span across 2 columns if Cost Price is hidden */}
                    <div className={productType === 'SERVICE' ? "sm:col-span-2" : ""}>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Selling (1 Single Unit)</label>
                      <input value={formData.baseSellingPrice} onChange={(e)=>setFormData({...formData, baseSellingPrice: e.target.value})} type="number" placeholder="₦0.00" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Dynamic Bulk Packaging Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Bulk Packaging / Sizes</h3>
                    <button type="button" onClick={addPackagingRule} className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Add Package Size
                    </button>
                  </div>
                  
                  {packagingRules.map((rule, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative">
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Package Name</label>
                        <input value={rule.name} onChange={(e) => updatePackagingRule(index, 'name', e.target.value)} type="text" placeholder="e.g. Carton, 100ml" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="col-span-12 sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Contains how many?</label>
                        <input value={rule.multiplier} onChange={(e) => updatePackagingRule(index, 'multiplier', e.target.value)} type="number" placeholder="e.g. 120" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Bulk Cost</label>
                        <input value={rule.cost} onChange={(e) => updatePackagingRule(index, 'cost', e.target.value)} type="number" placeholder="₦0" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Bulk Selling</label>
                        <input value={rule.selling} onChange={(e) => updatePackagingRule(index, 'selling', e.target.value)} type="number" placeholder="₦0" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex justify-end pb-1">
                        <button type="button" onClick={() => removePackagingRule(index)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {packagingRules.length === 0 && (
                    <p className="text-sm text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">No bulk packages. Click &quot;Add Package Size&quot; above.</p>
                  )}
                </div>

                <div className="pt-5 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                  <button disabled={isSubmitting} type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (editingItem ? "Save Changes" : "Create Item")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && itemToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50"><AlertTriangle className="w-8 h-8 text-red-600" /></div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Item?</h2>
              <p className="text-sm text-slate-500 mb-6">Are you sure you want to delete <strong className="text-slate-900">{itemToDelete.item_name}</strong>? This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={isSubmitting} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex justify-center items-center">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PENDING SETUP MODAL FOR AI AUTO-CREATIONS */}
      <AnimatePresence>
        {showPendingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">Vedly AI Needs Your Help</h3>
                  <p className="text-sm text-amber-700 mt-1">I created {pendingProducts.length} new items via WhatsApp today, but they don&apos;t have prices yet!</p>
                </div>
              </div>
              
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                {pendingProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">{product.item_name}</span>
                      <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-200 rounded text-[10px] uppercase font-bold tracking-wider">{product.product_type}</span>
                    </div>
                    <button onClick={() => {
                       setShowPendingModal(false);
                       const fullItem = inventory.find(i => i.id === product.id);
                       if(fullItem) openEditModal(fullItem);
                    }} className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-emerald-700 transition-colors">
                      Set Price
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setShowPendingModal(false)} className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">I&apos;ll do it later</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}