import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { LuauExportMode, RobloxModelData } from '../types/robloxModel';

interface LuauExportPanelProps {
  model: RobloxModelData;
  luauScript: string;
  exportMode: LuauExportMode;
  onChangeMode: (mode: LuauExportMode) => void;
}

export function LuauExportPanel({
  model,
  luauScript,
  exportMode,
  onChangeMode,
}: LuauExportPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(luauScript);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = luauScript;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([luauScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name || 'BloxCraftModel'}.lua`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = luauScript.split('\n').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/8 dark:bg-white/10">
          <button
            type="button"
            onClick={() => onChangeMode('anchored')}
            className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              exportMode === 'anchored'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Ancorado
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('welded')}
            className={`min-h-[34px] px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              exportMode === 'welded'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Soldado (Weld)
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          {model.parts.length} peças · {lineCount} linhas
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 min-h-[46px] px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Script Copiado!' : 'Copiar Script Luau'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownload}
          className="min-h-[46px] px-3.5 rounded-2xl bg-white/75 dark:bg-white/10 border border-slate-900/10 dark:border-white/15 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>.lua</span>
        </button>
      </div>

      {/* Code Preview */}
      <div className="rounded-2xl bg-slate-950 text-slate-100 border border-slate-800/80 p-3 max-h-[200px] overflow-auto glass-scroll">
        <pre className="font-code text-[11px] leading-relaxed whitespace-pre select-all">
          {luauScript}
        </pre>
      </div>

      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
        No <strong>Roblox Studio Lite</strong>, abra o editor de Script (ou Barra de Comando), cole o código acima e execute para gerar o modelo inteiro no Workspace.
      </p>
    </div>
  );
}
