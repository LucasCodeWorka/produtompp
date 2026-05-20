'use client';

import { useState, createContext, useContext, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface Config {
  periodoInicio: string;
  periodoFim: string;
  margemPercentual: number;
  familias: { anterior: string; nova: string }[];
}

interface ConfigContextType {
  config: Config;
  setConfig: (config: Config) => void;
  saveConfig: (config: Config) => Promise<void>;
  loading: boolean;
}

const defaultConfig: Config = {
  periodoInicio: '2025-07-01',
  periodoFim: '2025-12-31',
  margemPercentual: 10,
  familias: [
    { anterior: 'SORRENTINA', nova: 'BLOOM' }
  ]
};

const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  setConfig: () => {},
  saveConfig: async () => {},
  loading: true
});

export const useConfig = () => useContext(ConfigContext);

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setConfig(data.config);
          }
        }
      } catch (error) {
        console.log('Usando configurações padrão');
      }
      setLoading(false);
    };
    loadConfig();
  }, [API_URL]);

  const saveConfig = async (newConfig: Config) => {
    try {
      const res = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(newConfig);
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    }
  };

  const menuItems = [
    { href: '/', label: 'Análise', icon: '📊' },
    { href: '/config', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <ConfigContext.Provider value={{ config, setConfig, saveConfig, loading }}>
      <div className="flex min-h-screen bg-gray-950">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-gray-900 border-r border-gray-800 transition-all duration-200 flex flex-col`}>
          {/* Logo */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h1 className="text-base font-semibold text-white">Análise MP</h1>
                <p className="text-[10px] text-gray-500">Consumo de Matéria-Prima</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-white transition-colors"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="text-sm">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          {sidebarOpen && (
            <div className="p-4 border-t border-gray-800 text-xs text-gray-500 space-y-2">
              <div className="flex justify-between">
                <span>Período:</span>
                <span className="text-gray-400">
                  {config.periodoInicio?.slice(5, 7)}/{config.periodoInicio?.slice(0, 4)} - {config.periodoFim?.slice(5, 7)}/{config.periodoFim?.slice(0, 4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Margem:</span>
                <span className="text-green-500">{config.margemPercentual}%</span>
              </div>
              <div className="flex justify-between">
                <span>Famílias:</span>
                <span className="text-blue-400">{config.familias?.length || 0}</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </ConfigContext.Provider>
  );
}
