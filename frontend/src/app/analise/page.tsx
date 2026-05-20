'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ResumoMensal {
  mes: string;
  total_bojos_consumidos: number;
  total_pecas_vendidas: number;
  qtd_tipos_bojo: string;
}

interface Estatisticas {
  media_mensal_bojos: number;
  total_meses_analisados: number;
  total_bojos_periodo: number;
  compra_minima_sugerida: number;
}

interface AnaliseData {
  familia: string;
  periodo: string;
  resumo_mensal: ResumoMensal[];
  estatisticas: Estatisticas;
}

export default function AnalisePage() {
  const [data, setData] = useState<AnaliseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [familia, setFamilia] = useState('SORRENTINA');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/analise/consumo-bojo?familia=${familia}`);
      const result = await res.json();
      setData(result.data || null);
      setFromCache(result.fromCache || false);
    } catch (error) {
      console.error('Erro:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, [familia]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">&larr; Voltar</Link>
        <h1 className="text-2xl font-bold text-white">Análise de Consumo de Bojos</h1>
        {data?.periodo && <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase px-2 py-1 rounded">{data.periodo}</span>}
        {fromCache && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase px-2 py-1 rounded">Cache</span>}
      </header>

      {/* Link para comparativo de artigos */}
      <Link href="/analise/comparativo" className="block mb-8 group">
        <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/40 border border-indigo-500/20 rounded-2xl p-6 group-hover:border-indigo-500/40 transition-all shadow-lg backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-1 text-shadow-sm">Ver Comparativo de TODOS os Artigos</h2>
          <p className="text-indigo-300 text-sm opacity-80 font-medium italic">Tabela lateralizada: SORRENTINA vs BLOOM com compra mínima sugerida</p>
        </div>
      </Link>

      <div className="mb-8 flex gap-6 items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-sm">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Família de referência</label>
          <select
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white min-w-[200px] focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:border-slate-600"
          >
            <option value="SORRENTINA">SORRENTINA (base)</option>
            <option value="BLOOM">BLOOM</option>
          </select>
        </div>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold px-8 py-2.5 rounded-xl h-[46px] mt-4 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
        >
          {loading ? 'Carregando...' : 'Atualizar Dados'}
        </button>
      </div>

      {data && (
        <>
          {/* Cards de estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Média Mensal</p>
              <p className="text-3xl font-black text-blue-400">{data.estatisticas.media_mensal_bojos}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Período</p>
              <p className="text-3xl font-black text-white">{data.estatisticas.total_bojos_periodo}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Meses Analisados</p>
              <p className="text-3xl font-black text-white">{data.estatisticas.total_meses_analisados}</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 shadow-lg shadow-emerald-900/5">
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-2">Compra Mínima</p>
              <p className="text-3xl font-black text-emerald-400">{data.estatisticas.compra_minima_sugerida}</p>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 uppercase tracking-tighter">(Consumo Médio + 10% margem)</p>
            </div>
          </div>

          {/* Explicação */}
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <span className="text-2xl mt-1">💡</span>
            <div className="text-slate-300 leading-relaxed">
              <p className="mb-2">A família <strong className="text-white">{data.familia}</strong> consumiu em média <strong className="text-blue-400">{data.estatisticas.media_mensal_bojos} bojos por mês</strong>.</p>
              {familia === 'SORRENTINA' && (
                <p>
                  Para a <strong className="text-indigo-400 uppercase">BLOOM</strong> substituir a SORRENTINA mantendo o ritmo, a compra mínima recomendada é de{' '}
                  <strong className="text-emerald-400 text-lg">{data.estatisticas.compra_minima_sugerida} unidades/mês</strong>.
                </p>
              )}
            </div>
          </div>

          {/* Tabela de resumo mensal */}
          <h2 className="text-xl font-bold mb-6 text-slate-300 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
            Detalhamento do Consumo Mensal
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
                    <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">Mês de Referência</th>
                    <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Bojos Consumidos</th>
                    <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Peças Vendidas</th>
                    <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">Variedade de Bojo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.resumo_mensal.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-200">{item.mes}</td>
                      <td className="px-6 py-4 text-right text-blue-400 font-black">{item.total_bojos_consumidos}</td>
                      <td className="px-6 py-4 text-right text-slate-400 font-medium">{item.total_pecas_vendidas}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{item.qtd_tipos_bojo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
