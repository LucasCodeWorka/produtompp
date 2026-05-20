'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useConfig } from '@/components/AppShell';

interface ArtigoComparativo {
  artigo: string;
  qtd_skus_anterior: number;
  qtd_skus_nova: number;
  qtd_mps_anterior: number;
  qtd_mps_nova: number;
  pecas_vendidas_anterior: number;
  pecas_vendidas_nova: number;
  consumo_anterior: number;
  consumo_nova: number;
  compra_minima_sugerida: number;
  nova_projetado?: boolean;
}

interface SkuDetalhe {
  cd_sku: string;
  ds_sku: string;
  qt_consumo: number;
  pecas_vendidas: number;
  total_consumo: number;
}

interface MpDetalhe {
  cd_mp: string;
  ds_mp: string;
  total_consumo: number;
}

interface DetalheEstatisticas {
  total_consumo: number;
  qtd_skus: number;
  qtd_mps: number;
  consumo_medio: number;
}

interface DetalheResponse {
  artigo: string;
  familia: string;
  familiaAnterior: string;
  periodo: string;
  projetado?: boolean;
  estatisticas: DetalheEstatisticas;
  skus: SkuDetalhe[];
  mps: MpDetalhe[];
}

interface ApiResponse {
  familiaAnterior: string;
  familiaNova: string;
  periodo: string;
  margem: number;
  artigos: ArtigoComparativo[];
}

export default function AnalysisPage() {
  const { config, loading: configLoading } = useConfig();
  const [data, setData] = useState<ArtigoComparativo[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [apiPeriodo, setApiPeriodo] = useState('');

  const [selectedFamilia, setSelectedFamilia] = useState<number>(0);
  const [artigoFilter, setArtigoFilter] = useState('');

  const [expandedArtigo, setExpandedArtigo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheResponse | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [familiaDetalhe, setFamiliaDetalhe] = useState<'anterior' | 'nova'>('anterior');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const familiaAtual = config.familias[selectedFamilia] || { anterior: 'SORRENTINA', nova: 'BLOOM' };

  const filteredData = useMemo(() => {
    if (!artigoFilter.trim()) return data;
    return data.filter(item =>
      item.artigo.toLowerCase().includes(artigoFilter.toLowerCase())
    );
  }, [data, artigoFilter]);

  const carregarDados = async () => {
    setLoading(true);
    setExpandedArtigo(null);
    setDetalhe(null);

    try {
      const params = new URLSearchParams({
        familiaAnterior: familiaAtual.anterior,
        familiaNova: familiaAtual.nova,
        periodoInicio: config.periodoInicio,
        periodoFim: config.periodoFim,
        margem: String(config.margemPercentual)
      });

      const res = await fetch(`${API_URL}/analise/artigos-comparativo-v2?${params}`);
      const result = await res.json();
      const apiData: ApiResponse = result.data || { familiaAnterior: '', familiaNova: '', periodo: '', margem: 10, artigos: [] };
      setData(apiData.artigos || []);
      setApiPeriodo(apiData.periodo || '');
      setFromCache(result.fromCache || false);
    } catch (error) {
      console.error('Erro:', error);
    }
    setLoading(false);
  };

  const carregarDetalhe = async (artigo: string, familia: 'anterior' | 'nova') => {
    setLoadingDetalhe(true);
    try {
      const familiaParam = familia === 'anterior' ? familiaAtual.anterior : familiaAtual.nova;
      const params = new URLSearchParams({
        familia: familiaParam,
        familiaAnterior: familiaAtual.anterior,
        periodoInicio: config.periodoInicio,
        periodoFim: config.periodoFim,
        margem: String(config.margemPercentual)
      });

      const res = await fetch(`${API_URL}/analise/artigo-detalhe-v2/${encodeURIComponent(artigo)}?${params}`);
      const result = await res.json();
      setDetalhe(result.data || null);
    } catch (error) {
      console.error('Erro:', error);
    }
    setLoadingDetalhe(false);
  };

  const toggleExpand = async (artigo: string) => {
    if (expandedArtigo === artigo) {
      setExpandedArtigo(null);
      setDetalhe(null);
    } else {
      setExpandedArtigo(artigo);
      setFamiliaDetalhe('anterior');
      await carregarDetalhe(artigo, 'anterior');
    }
  };

  const mudarFamiliaDetalhe = async (familia: 'anterior' | 'nova') => {
    setFamiliaDetalhe(familia);
    if (expandedArtigo) {
      await carregarDetalhe(expandedArtigo, familia);
    }
  };

  useEffect(() => {
    if (!configLoading && config.familias.length > 0) {
      carregarDados();
    }
  }, [configLoading, selectedFamilia, config.periodoInicio, config.periodoFim, config.margemPercentual]);

  if (configLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Comparativo de Consumo</h1>
        <p className="text-gray-500 text-sm mt-1">Analise o consumo de matéria-prima entre famílias</p>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Família</label>
          <select
            value={selectedFamilia}
            onChange={(e) => setSelectedFamilia(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white min-w-[200px]"
          >
            {config.familias.map((f, idx) => (
              <option key={idx} value={idx}>
                {f.anterior} → {f.nova}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Buscar artigo</label>
          <input
            type="text"
            value={artigoFilter}
            onChange={(e) => setArtigoFilter(e.target.value)}
            placeholder="Digite..."
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white w-48"
          />
        </div>

        <button
          onClick={carregarDados}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded mt-5"
        >
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs">
          {apiPeriodo && <span className="text-gray-400">{apiPeriodo}</span>}
          <span className="text-green-500">{config.margemPercentual}% margem</span>
          {fromCache && <span className="text-gray-600">cache</span>}
          <span className="text-gray-500">{filteredData.length} artigos</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Artigo</th>
              <th className="text-center px-2 py-3 text-purple-400 font-medium" colSpan={4}>{familiaAtual.anterior}</th>
              <th className="text-center px-2 py-3 text-cyan-400 font-medium" colSpan={4}>{familiaAtual.nova}</th>
              <th className="text-right px-4 py-3 text-green-400 font-medium">Compra Mín.</th>
            </tr>
            <tr className="border-b border-gray-800 text-[11px] text-gray-500">
              <th className="px-4 py-2"></th>
              <th className="px-2 py-2 text-right">SKUs</th>
              <th className="px-2 py-2 text-right">MPs</th>
              <th className="px-2 py-2 text-right">Vendas</th>
              <th className="px-2 py-2 text-right text-purple-400/70">Consumo</th>
              <th className="px-2 py-2 text-right">SKUs</th>
              <th className="px-2 py-2 text-right">MPs</th>
              <th className="px-2 py-2 text-right">Vendas</th>
              <th className="px-2 py-2 text-right text-cyan-400/70">Consumo</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr
                  className={`border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors ${expandedArtigo === item.artigo ? 'bg-gray-800/50' : ''}`}
                  onClick={() => toggleExpand(item.artigo)}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    <span className="text-gray-600 mr-2 text-[10px]">{expandedArtigo === item.artigo ? '▼' : '▶'}</span>
                    {item.artigo}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-400">{item.qtd_skus_anterior}</td>
                  <td className="px-2 py-3 text-right text-gray-400">{item.qtd_mps_anterior}</td>
                  <td className="px-2 py-3 text-right text-gray-400">{item.pecas_vendidas_anterior.toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-3 text-right text-purple-400 font-medium">{item.consumo_anterior.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>

                  <td className="px-2 py-3 text-right text-gray-400">
                    {item.qtd_skus_nova}
                    {item.nova_projetado && <span className="text-yellow-500 ml-1">*</span>}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-400">
                    {item.qtd_mps_nova}
                    {item.nova_projetado && <span className="text-yellow-500 ml-1">*</span>}
                  </td>
                  <td className="px-2 py-3 text-right text-gray-400">{item.pecas_vendidas_nova.toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-3 text-right text-cyan-400 font-medium">
                    {item.consumo_nova.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    {item.nova_projetado && <span className="text-yellow-500 ml-1">*</span>}
                  </td>

                  <td className="px-4 py-3 text-right text-green-400 font-semibold">{item.compra_minima_sugerida.toLocaleString('pt-BR')}</td>
                </tr>

                {/* Drill-down */}
                {expandedArtigo === item.artigo && (
                  <tr>
                    <td colSpan={10} className="bg-gray-950 p-6">
                      {loadingDetalhe ? (
                        <div className="text-center py-8">
                          <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                          <p className="text-gray-500 text-sm mt-2">Carregando...</p>
                        </div>
                      ) : detalhe ? (
                        <div>
                          {/* Tabs */}
                          <div className="flex items-center gap-4 mb-6">
                            <div className="flex bg-gray-900 rounded overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); mudarFamiliaDetalhe('anterior'); }}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${familiaDetalhe === 'anterior' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                              >
                                {familiaAtual.anterior}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); mudarFamiliaDetalhe('nova'); }}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${familiaDetalhe === 'nova' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                              >
                                {familiaAtual.nova}
                              </button>
                            </div>

                            {detalhe.projetado && (
                              <span className="text-yellow-500 text-xs bg-yellow-500/10 px-3 py-1 rounded">
                                Projetado com base na {familiaAtual.anterior}
                              </span>
                            )}
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-900 rounded-lg p-4">
                              <p className="text-gray-500 text-xs mb-1">Consumo Total</p>
                              <p className="text-xl font-semibold text-white">{detalhe.estatisticas.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4">
                              <p className="text-gray-500 text-xs mb-1">Qtd MPs</p>
                              <p className="text-xl font-semibold text-white">{detalhe.estatisticas.qtd_mps}</p>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-4 border border-blue-500/30">
                              <p className="text-blue-400 text-xs mb-1">Consumo Médio</p>
                              <p className="text-xl font-semibold text-blue-400">{detalhe.estatisticas.consumo_medio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            {/* SKUs */}
                            <div className="bg-gray-900 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-300">SKUs</span>
                                <span className="text-xs text-gray-500">{detalhe.skus.length}</span>
                              </div>
                              <div className="max-h-72 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-800/50 sticky top-0">
                                    <tr className="text-gray-500">
                                      <th className="px-3 py-2 text-left">Código</th>
                                      <th className="px-3 py-2 text-left">Descrição</th>
                                      <th className="px-3 py-2 text-right">Qt</th>
                                      <th className="px-3 py-2 text-right">Vendas</th>
                                      <th className="px-3 py-2 text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-800/50">
                                    {detalhe.skus.map((sku, i) => (
                                      <tr key={i} className="hover:bg-gray-800/30">
                                        <td className="px-3 py-2 text-gray-400 font-mono">{sku.cd_sku}</td>
                                        <td className="px-3 py-2 text-gray-300 truncate max-w-[150px]" title={sku.ds_sku}>{sku.ds_sku}</td>
                                        <td className="px-3 py-2 text-right text-yellow-500">{sku.qt_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                        <td className="px-3 py-2 text-right text-gray-400">{sku.pecas_vendidas.toLocaleString('pt-BR')}</td>
                                        <td className="px-3 py-2 text-right text-white font-medium">{sku.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* MPs */}
                            <div className="bg-gray-900 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-300">Matérias-Primas</span>
                                <span className="text-xs text-gray-500">{detalhe.mps.length}</span>
                              </div>
                              <div className="max-h-72 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-800/50 sticky top-0">
                                    <tr className="text-gray-500">
                                      <th className="px-3 py-2 text-left">Código</th>
                                      <th className="px-3 py-2 text-left">Descrição</th>
                                      <th className="px-3 py-2 text-right">Consumo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-800/50">
                                    {detalhe.mps.map((mp, i) => (
                                      <tr key={i} className="hover:bg-gray-800/30">
                                        <td className="px-3 py-2 text-gray-400 font-mono">{mp.cd_mp}</td>
                                        <td className="px-3 py-2 text-gray-300 truncate max-w-[180px]" title={mp.ds_mp}>{mp.ds_mp}</td>
                                        <td className="px-3 py-2 text-right text-cyan-400 font-medium">{mp.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">Sem dados</p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-gray-800/50 border-t border-gray-700">
            <tr className="font-medium">
              <td className="px-4 py-3 text-white">Total</td>
              <td className="px-2 py-3 text-right text-gray-400">{filteredData.reduce((acc, item) => acc + item.qtd_skus_anterior, 0)}</td>
              <td className="px-2 py-3 text-right text-gray-400">-</td>
              <td className="px-2 py-3 text-right text-gray-400">{filteredData.reduce((acc, item) => acc + item.pecas_vendidas_anterior, 0).toLocaleString('pt-BR')}</td>
              <td className="px-2 py-3 text-right text-purple-400">{filteredData.reduce((acc, item) => acc + item.consumo_anterior, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>

              <td className="px-2 py-3 text-right text-gray-400">{filteredData.reduce((acc, item) => acc + item.qtd_skus_nova, 0)}</td>
              <td className="px-2 py-3 text-right text-gray-400">-</td>
              <td className="px-2 py-3 text-right text-gray-400">{filteredData.reduce((acc, item) => acc + item.pecas_vendidas_nova, 0).toLocaleString('pt-BR')}</td>
              <td className="px-2 py-3 text-right text-cyan-400">{filteredData.reduce((acc, item) => acc + item.consumo_nova, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>

              <td className="px-4 py-3 text-right text-green-400 font-semibold">{filteredData.reduce((acc, item) => acc + item.compra_minima_sugerida, 0).toLocaleString('pt-BR')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legenda */}
      <div className="mt-4 text-xs text-gray-600 flex gap-6">
        <span><span className="text-yellow-500">*</span> Projetado: sem vendas, baseado na família anterior</span>
        <span>Compra Mín = Consumo Médio + {config.margemPercentual}%</span>
      </div>
    </div>
  );
}
