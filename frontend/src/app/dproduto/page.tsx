'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Produto {
  cd_produto: number;
  ds_produto: string;
  familia: string | null;
  artigo: string | null;
  [key: string]: unknown;
}

export default function DProdutoPage() {
  const [data, setData] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [familia, setFamilia] = useState('SORRENTINA');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dproduto?familia=${familia}`);
      const result = await res.json();
      setData(result.data || []);
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
        <h1 className="text-2xl font-bold">Produtos Acabados (PA)</h1>
        {fromCache && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase px-2 py-1 rounded">Cache</span>}
      </header>

      <div className="mb-6 flex gap-4 items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <select
          value={familia}
          onChange={(e) => setFamilia(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
        >
          <option value="SORRENTINA">SORRENTINA</option>
          <option value="BLOOM">BLOOM</option>
        </select>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 px-6 py-2 rounded-lg font-bold transition-all"
        >
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Descrição</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Família</th>
                <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Artigo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400">{item.cd_produto}</td>
                  <td className="px-4 py-3 font-medium">{item.ds_produto}</td>
                  <td className="px-4 py-3 text-slate-400">{item.familia || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{item.artigo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
          <p className="text-slate-400 text-sm mt-4">Mostrando 100 de {data.length} registros</p>
        )}
      </div>
    </div>
  );
}
