'use client';

import { useState, useRef, useEffect } from 'react';
import { useConfig, Config } from '@/components/AppShell';

export default function ConfigPage() {
  const { config, saveConfig, loading } = useConfig();
  const [localConfig, setLocalConfig] = useState<Config>(config);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) {
      setLocalConfig(config);
    }
  }, [loading, config]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveConfig(localConfig);
      setMessage({ type: 'success', text: 'Configurações salvas!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    }
    setSaving(false);
  };

  const handleAddFamilia = () => {
    setLocalConfig({
      ...localConfig,
      familias: [...localConfig.familias, { anterior: '', nova: '' }]
    });
  };

  const handleRemoveFamilia = (index: number) => {
    setLocalConfig({
      ...localConfig,
      familias: localConfig.familias.filter((_, i) => i !== index)
    });
  };

  const handleFamiliaChange = (index: number, field: 'anterior' | 'nova', value: string) => {
    const newFamilias = [...localConfig.familias];
    newFamilias[index] = { ...newFamilias[index], [field]: value.toUpperCase() };
    setLocalConfig({ ...localConfig, familias: newFamilias });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const startIndex = lines[0].toLowerCase().includes('anterior') ? 1 : 0;
      const newFamilias: { anterior: string; nova: string }[] = [];

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(/[,;|\t]/).map(p => p.trim().toUpperCase());
        if (parts.length >= 2 && parts[0] && parts[1]) {
          newFamilias.push({ anterior: parts[0], nova: parts[1] });
        }
      }

      if (newFamilias.length > 0) {
        setLocalConfig({ ...localConfig, familias: newFamilias });
        setMessage({ type: 'success', text: `${newFamilias.length} famílias importadas` });
      } else {
        setMessage({ type: 'error', text: 'Nenhuma família encontrada no arquivo' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao processar arquivo' });
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-950 min-h-screen">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Configurações</h1>
          <p className="text-gray-500 text-sm mt-1">Ajuste os parâmetros de análise</p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {message.text}
          </div>
        )}

        {/* Período */}
        <div className="bg-gray-900 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-medium text-white mb-4">Período de Análise</h2>
          <p className="text-xs text-gray-500 mb-4">Define o período da coleção anterior para calcular consumo</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Início</label>
              <input
                type="date"
                value={localConfig.periodoInicio}
                onChange={(e) => setLocalConfig({ ...localConfig, periodoInicio: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fim</label>
              <input
                type="date"
                value={localConfig.periodoFim}
                onChange={(e) => setLocalConfig({ ...localConfig, periodoFim: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Margem */}
        <div className="bg-gray-900 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-medium text-white mb-4">Margem de Segurança</h2>
          <p className="text-xs text-gray-500 mb-4">Percentual adicional sobre o consumo médio</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="50"
              value={localConfig.margemPercentual}
              onChange={(e) => setLocalConfig({ ...localConfig, margemPercentual: Number(e.target.value) })}
              className="flex-1"
            />
            <div className="bg-gray-800 border border-gray-700 rounded px-4 py-2 min-w-[80px] text-center">
              <span className="text-xl font-semibold text-green-400">{localConfig.margemPercentual}</span>
              <span className="text-gray-500 ml-1">%</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Compra Mínima = Consumo Médio x (1 + {localConfig.margemPercentual}%)
          </p>
        </div>

        {/* Famílias */}
        <div className="bg-gray-900 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-white">Famílias de Produtos</h2>
              <p className="text-xs text-gray-500 mt-1">Mapeamento entre famílias anteriores e novas</p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded cursor-pointer"
              >
                {uploading ? 'Importando...' : 'Importar CSV'}
              </label>
              <button
                onClick={handleAddFamilia}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded"
              >
                + Adicionar
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-600 bg-gray-800/50 rounded p-2 mb-4">
            Formato CSV: ANTERIOR,NOVA (uma por linha)
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
              <div className="col-span-5">Família Anterior</div>
              <div className="col-span-1 text-center">→</div>
              <div className="col-span-5">Família Nova</div>
              <div className="col-span-1"></div>
            </div>

            {localConfig.familias.map((familia, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={familia.anterior}
                  onChange={(e) => handleFamiliaChange(index, 'anterior', e.target.value)}
                  placeholder="Ex: SORRENTINA"
                  className="col-span-5 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
                <div className="col-span-1 text-center text-gray-600">→</div>
                <input
                  type="text"
                  value={familia.nova}
                  onChange={(e) => handleFamiliaChange(index, 'nova', e.target.value)}
                  placeholder="Ex: BLOOM"
                  className="col-span-5 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={() => handleRemoveFamilia(index)}
                  className="col-span-1 text-gray-600 hover:text-red-400 text-center"
                >
                  ✕
                </button>
              </div>
            ))}

            {localConfig.familias.length === 0 && (
              <p className="text-gray-600 text-center py-6 text-sm">
                Nenhuma família configurada
              </p>
            )}
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setLocalConfig(config)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded text-sm font-medium"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
