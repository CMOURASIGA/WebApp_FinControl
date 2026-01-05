
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSave: (categories: string[]) => Promise<void>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, onSave }) => {
  const [newCategory, setNewCategory] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);

  // Sync with props when categories update or modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalCategories(categories);
    }
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !localCategories.includes(trimmed)) {
      setLocalCategories([...localCategories, trimmed]);
      setNewCategory('');
    }
  };

  const handleRemove = (cat: string) => {
    if (localCategories.length <= 1) {
      alert("Você precisa ter pelo menos uma categoria cadastrada.");
      return;
    }
    setLocalCategories(localCategories.filter(c => c !== cat));
  };

  const handleSave = async () => {
    try {
      await onSave(localCategories);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar categorias:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="max-w-md w-full shadow-2xl border-none">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Minhas Categorias</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Adicione categorias personalizadas para organizar melhor suas finanças.
          </p>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Nova categoria (ex: Assinaturas)..." 
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} size="sm" className="shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {localCategories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg group hover:bg-slate-100 transition-colors">
                <span className="text-sm font-semibold text-slate-700">{cat}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRemove(cat)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 h-8 w-8 p-0 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 p-3 rounded-lg flex gap-2 border border-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-tight">
              Atenção: Ao remover uma categoria, ela deixará de aparecer nas opções de novos lançamentos, mas lançamentos antigos permanecerão com o nome original.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} className="flex-1 shadow-lg shadow-blue-100">Salvar Alterações</Button>
        </div>
      </Card>
    </div>
  );
};
