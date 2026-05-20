'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ArtigoComparativo {
  artigo: string;
  qtd_skus_sorrentina: number;
  qtd_skus_bloom: number;
  qtd_mps_sorrentina: number;
  qtd_mps_bloom: number;
  pecas_vendidas_sorrentina: number;
  pecas_vendidas_bloom: number;
  consumo_sorrentina: number;
  consumo_bloom: number;
  compra_minima_sugerida: number;
  bloom_projetado?: boolean;
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
  periodo: string;
  projetado?: boolean;
  estatisticas: DetalheEstatisticas;
  skus: SkuDetalhe[];
  mps: MpDetalhe[];
}

interface ApiResponse {
  periodo: string;
  artigos: ArtigoComparativo[];
}

export default function ComparativoPage() {
  const [data, setData] = useState<ArtigoComparativo[]>([]);
  const [periodo, setPeriodo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Estado para drill-down
  const [expandedArtigo, setExpandedArtigo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheResponse | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [familiaDetalhe, setFamiliaDetalhe] = useState<'SORRENTINA' | 'BLOOM'>('SORRENTINA');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/analise/artigos-comparativo`);
      const result = await res.json();
      const apiData: ApiResponse = result.data || { periodo: '', artigos: [] };
      setData(apiData.artigos || []);
      setPeriodo(apiData.periodo || '');
      setFromCache(result.fromCache || false);
    } catch (error) {
      console.error('Erro:', error);
    }
    setLoading(false);
  };

  const carregarDetalhe = async (artigo: string, familia: 'SORRENTINA' | 'BLOOM') => {
    setLoadingDetalhe(true);
    try {
      const res = await fetch(`${API_URL}/analise/artigo-detalhe/${encodeURIComponent(artigo)}?familia=${familia}`);
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
      setFamiliaDetalhe('SORRENTINA');
      await carregarDetalhe(artigo, 'SORRENTINA');
    }
  };

  const mudarFamiliaDetalhe = async (familia: 'SORRENTINA' | 'BLOOM') => {
    setFamiliaDetalhe(familia);
    if (expandedArtigo) {
      await carregarDetalhe(expandedArtigo, familia);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/analise" className="text-blue-400 hover:text-blue-300">&larr; Voltar</Link>
        <h1 className="text-2xl font-bold">Comparativo de Artigos: SORRENTINA vs BLOOM</h1>
        {periodo && <span className="bg-purple-600 text-xs px-2 py-1 rounded">{periodo}</span>}
        {fromCache && <span className="bg-green-600 text-xs px-2 py-1 rounded">Cache</span>}
      </header>

      <div className="mb-6 flex gap-4 items-center">
        <button
          onClick={carregarDados}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 px-4 py-2 rounded"
        >
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
        <span className="text-slate-400 text-sm">{data.length} artigos</span>
        <span className="text-slate-500 text-sm">| Clique em um artigo para ver os SKUs e MPs</span>
      </div>

      {/* Legenda */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-400">
          <strong className="text-white">SKUs:</strong> Produtos acabados que usam este artigo |
          <strong className="text-white ml-2">MPs:</strong> Matérias-primas diferentes deste artigo |
          <strong className="text-white ml-2">Compra Mínima:</strong> Consumo SORRENTINA + 10% |
          <span className="text-yellow-500 ml-2">*</span> <strong className="text-white">Projetado:</strong> BLOOM sem vendas, dados baseados na SORRENTINA
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-3 text-left">Artigo</th>
              <th className="px-2 py-3 text-center bg-purple-900/30" colSpan={4}>SORRENTINA</th>
              <th className="px-2 py-3 text-center bg-blue-900/30" colSpan={4}>BLOOM</th>
              <th className="px-3 py-3 text-right bg-green-900/50">Compra Mín.</th>
            </tr>
            <tr className="bg-slate-900/50 text-xs">
              <th className="px-3 py-2"></th>
              <th className="px-2 py-2 text-right text-purple-300">SKUs</th>
              <th className="px-2 py-2 text-right text-purple-300">MPs</th>
              <th className="px-2 py-2 text-right text-purple-300">Vendas</th>
              <th className="px-2 py-2 text-right text-purple-300">Consumo</th>
              <th className="px-2 py-2 text-right text-blue-300">SKUs</th>
              <th className="px-2 py-2 text-right text-blue-300">MPs</th>
              <th className="px-2 py-2 text-right text-blue-300">Vendas</th>
              <th className="px-2 py-2 text-right text-blue-300">Consumo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr
                  className={`border-b border-slate-800 hover:bg-slate-800 cursor-pointer ${expandedArtigo === item.artigo ? 'bg-slate-900' : ''}`}
                  onClick={() => toggleExpand(item.artigo)}
                >
                  <td className="px-3 py-3 font-medium">
                    <span className="mr-2">{expandedArtigo === item.artigo ? '▼' : '▶'}</span>
                    {item.artigo}
                  </td>
                  <td className="px-2 py-3 text-right text-purple-400">{item.qtd_skus_sorrentina}</td>
                  <td className="px-2 py-3 text-right text-purple-400">{item.qtd_mps_sorrentina}</td>
                  <td className="px-2 py-3 text-right text-purple-400">{item.pecas_vendidas_sorrentina.toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-3 text-right text-purple-400 font-semibold">{item.consumo_sorrentina.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-3 text-right text-blue-400">
                    {item.qtd_skus_bloom}
                    {item.bloom_projetado && <span className="text-yellow-500 text-xs ml-1">*</span>}
                  </td>
                  <td className="px-2 py-3 text-right text-blue-400">
                    {item.qtd_mps_bloom}
                    {item.bloom_projetado && <span className="text-yellow-500 text-xs ml-1">*</span>}
                  </td>
                  <td className="px-2 py-3 text-right text-blue-400">{item.pecas_vendidas_bloom.toLocaleString('pt-BR')}</td>
                  <td className="px-2 py-3 text-right text-blue-400 font-semibold">
                    {item.consumo_bloom.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    {item.bloom_projetado && <span className="text-yellow-500 text-xs ml-1">*</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-green-400 font-semibold">{item.compra_minima_sugerida.toLocaleString('pt-BR')}</td>
                </tr>

                {/* Drill-down */}
                {expandedArtigo === item.artigo && (
                  <tr>
                    <td colSpan={10} className="bg-slate-900/50 p-4">
                      {loadingDetalhe ? (
                        <p className="text-slate-400">Carregando detalhes...</p>
                      ) : detalhe ? (
                        <div>
                          {/* Tabs para família */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); mudarFamiliaDetalhe('SORRENTINA'); }}
                              className={`px-4 py-2 rounded ${familiaDetalhe === 'SORRENTINA' ? 'bg-purple-600' : 'bg-slate-800'}`}
                            >
                              SORRENTINA
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); mudarFamiliaDetalhe('BLOOM'); }}
                              className={`px-4 py-2 rounded ${familiaDetalhe === 'BLOOM' ? 'bg-blue-600' : 'bg-slate-800'}`}
                            >
                              BLOOM
                            </button>
                            {detalhe.projetado && (
                              <span className="bg-yellow-600 text-black text-xs px-2 py-1 rounded ml-2">
                                PROJETADO (baseado na SORRENTINA)
                              </span>
                            )}
                          </div>

                          {/* Card de Consumo Médio */}
                          <div className={`rounded-lg p-3 mb-4 flex gap-6 ${detalhe.projetado ? 'bg-yellow-900/30 border border-yellow-600' : 'bg-slate-800'}`}>
                            <div>
                              <span className="text-slate-400 text-xs">Total Consumo:</span>
                              <span className="ml-2 font-semibold">{detalhe.estatisticas.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">÷ Qtd MPs:</span>
                              <span className="ml-2 font-semibold">{detalhe.estatisticas.qtd_mps}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">= Consumo Médio:</span>
                              <span className="ml-2 font-bold text-green-400">{detalhe.estatisticas.consumo_medio.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* SKUs */}
                            <div>
                              <h4 className="font-semibold mb-2 text-zinc-300">SKUs ({detalhe.skus.length})</h4>
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-800 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">Código</th>
                                      <th className="px-2 py-1 text-left">Descrição</th>
                                      <th className="px-2 py-1 text-right">Qt Consumo</th>
                                      <th className="px-2 py-1 text-right">Vendas</th>
                                      <th className="px-2 py-1 text-right">Consumo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhe.skus.map((sku, i) => (
                                      <tr key={i} className="border-b border-slate-800">
                                        <td className="px-2 py-1">{sku.cd_sku}</td>
                                        <td className="px-2 py-1 truncate max-w-50" title={sku.ds_sku}>{sku.ds_sku}</td>
                                        <td className="px-2 py-1 text-right text-yellow-400">{sku.qt_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                        <td className="px-2 py-1 text-right">{sku.pecas_vendidas.toLocaleString('pt-BR')}</td>
                                        <td className="px-2 py-1 text-right">{sku.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* MPs */}
                            <div>
                              <h4 className="font-semibold mb-2 text-zinc-300">Matérias-Primas ({detalhe.mps.length})</h4>
                              <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-800 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">Código</th>
                                      <th className="px-2 py-1 text-left">Descrição</th>
                                      <th className="px-2 py-1 text-right">Consumo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhe.mps.map((mp, i) => (
                                      <tr key={i} className="border-b border-slate-800">
                                        <td className="px-2 py-1">{mp.cd_mp}</td>
                                        <td className="px-2 py-1 truncate max-w-[250px]" title={mp.ds_mp}>{mp.ds_mp}</td>
                                        <td className="px-2 py-1 text-right">{mp.total_consumo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400">Nenhum dado encontrado</p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 font-semibold">
            <tr>
              <td className="px-3 py-3">TOTAL</td>
              <td className="px-2 py-3 text-right text-purple-400">{data.reduce((acc, item) => acc + item.qtd_skus_sorrentina, 0)}</td>
              <td className="px-2 py-3 text-right text-purple-400">-</td>
              <td className="px-2 py-3 text-right text-purple-400">{data.reduce((acc, item) => acc + item.pecas_vendidas_sorrentina, 0).toLocaleString('pt-BR')}</td>
              <td className="px-2 py-3 text-right text-purple-400">{data.reduce((acc, item) => acc + item.consumo_sorrentina, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
              <td className="px-2 py-3 text-right text-blue-400">{data.reduce((acc, item) => acc + item.qtd_skus_bloom, 0)}</td>
              <td className="px-2 py-3 text-right text-blue-400">-</td>
              <td className="px-2 py-3 text-right text-blue-400">{data.reduce((acc, item) => acc + item.pecas_vendidas_bloom, 0).toLocaleString('pt-BR')}</td>
              <td className="px-2 py-3 text-right text-blue-400">{data.reduce((acc, item) => acc + item.consumo_bloom, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-3 text-right text-green-400">{data.reduce((acc, item) => acc + item.compra_minima_sugerida, 0).toLocaleString('pt-BR')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
