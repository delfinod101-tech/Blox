import { Plus, Star, Trash2 } from 'lucide-react';
import { RobloxModelData } from '../types/robloxModel';

interface PartsListPanelProps {
  model: RobloxModelData;
  selectedPartId: string | null;
  onSelectPart: (partId: string) => void;
  onDeletePart: (partId: string) => void;
  onAddPart: () => void;
  onRenameModel: (title: string) => void;
}

export function PartsListPanel({
  model,
  selectedPartId,
  onSelectPart,
  onDeletePart,
  onAddPart,
  onRenameModel,
}: PartsListPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={model.title}
          onChange={(e) => onRenameModel(e.target.value)}
          aria-label="Nome do modelo"
          className="flex-1 min-w-0 min-h-[42px] rounded-xl px-3 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <button
          type="button"
          onClick={onAddPart}
          className="min-h-[42px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Peça</span>
        </button>
      </div>

      <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 glass-scroll">
        {model.parts.map((part, idx) => {
          const isSelected = part.id === selectedPartId;
          return (
            <div
              key={part.id}
              className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 border transition-colors ${
                isSelected
                  ? 'bg-sky-500/14 border-sky-500/45'
                  : 'bg-white/60 dark:bg-white/6 border-slate-900/8 dark:border-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPart(part.id)}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
              >
                <span
                  className="w-5 h-5 rounded-lg border border-black/15 shrink-0"
                  style={{ backgroundColor: part.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {idx + 1}. {part.name}
                    </span>
                    {part.isPrimary ? (
                      <Star className="w-3 h-3 text-amber-500 shrink-0" />
                    ) : null}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                    {part.shape} · {part.material} · {part.size.x}×{part.size.y}×{part.size.z}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onDeletePart(part.id)}
                aria-label={`Excluir ${part.name}`}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
