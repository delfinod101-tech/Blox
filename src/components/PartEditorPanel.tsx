import { useState } from 'react';
import {
  CopyPlus,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import {
  ROBLOX_COLOR_PALETTE,
  ROBLOX_MATERIALS,
  ROBLOX_SHAPES,
  RobloxMaterial,
  RobloxPartData,
  RobloxShape,
  Vec3,
} from '../types/robloxModel';

interface PartEditorPanelProps {
  selectedPart: RobloxPartData | null;
  totalParts: number;
  isRefining: boolean;
  refineError: string | null;
  onUpdatePart: (partId: string, updater: (prev: RobloxPartData) => RobloxPartData) => void;
  onDuplicatePart: (partId: string) => void;
  onDeletePart: (partId: string) => void;
  onSetPrimaryPart: (partId: string) => void;
  onAddPart: () => void;
  onRefineWithAI: (instruction: string) => void;
  onOpenPartsTab: () => void;
}

type TransformMode = 'position' | 'size' | 'rotation';

export function PartEditorPanel({
  selectedPart,
  totalParts,
  isRefining,
  refineError,
  onUpdatePart,
  onDuplicatePart,
  onDeletePart,
  onSetPrimaryPart,
  onAddPart,
  onRefineWithAI,
  onOpenPartsTab,
}: PartEditorPanelProps) {
  const [transformMode, setTransformMode] = useState<TransformMode>('position');
  const [stepSize, setStepSize] = useState<number>(0.25);
  const [aiInstruction, setAiInstruction] = useState('');

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInstruction.trim() || isRefining) return;
    onRefineWithAI(aiInstruction.trim());
    setAiInstruction('');
  };

  if (!selectedPart) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl p-4 bg-white/55 dark:bg-white/6 border border-slate-900/8 dark:border-white/10 text-center space-y-2.5">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Toque em qualquer peça no 3D para editar
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Você pode mudar cor, material, forma, mover, redimensionar ou excluir qualquer parte do modelo.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenPartsTab}
              className="min-h-[44px] px-4 rounded-xl bg-white/80 dark:bg-white/10 border border-slate-900/10 dark:border-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap cursor-pointer"
            >
              Ver lista ({totalParts} peças)
            </button>
            <button
              type="button"
              onClick={onAddPart}
              className="min-h-[44px] px-4 rounded-xl bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Peça</span>
            </button>
          </div>
        </div>

        {/* AI Quick Edit even without selecting a specific part */}
        <form onSubmit={handleRefineSubmit} className="space-y-2">
          <label
            htmlFor="ai-refine-global"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200 block"
          >
            Ou peça uma alteração para a IA
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ai-refine-global"
              type="text"
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="Ex: Muda a coleira para azul e aumenta o rabo"
              className="flex-1 min-h-[44px] rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
            />
            <button
              type="submit"
              disabled={isRefining || !aiInstruction.trim()}
              className="min-h-[44px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Aplicar</span>
            </button>
          </div>
          {refineError ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">{refineError}</p>
          ) : null}
        </form>
      </div>
    );
  }

  const activeAxisStep = transformMode === 'rotation' ? (stepSize >= 1 ? 15 : 5) : stepSize;

  const nudgeAxis = (axis: keyof Vec3, delta: number) => {
    onUpdatePart(selectedPart.id, (prev) => {
      const nextVec = { ...prev[transformMode] };
      let val = Math.round((nextVec[axis] + delta) * 100) / 100;
      if (transformMode === 'size') {
        val = Math.max(0.05, Math.min(80, val));
        if (prev.shape === 'Ball') {
          return {
            ...prev,
            size: { x: val, y: val, z: val },
          };
        }
      }
      nextVec[axis] = val;
      return {
        ...prev,
        [transformMode]: nextVec,
      };
    });
  };

  const setAxisDirect = (axis: keyof Vec3, rawValue: string) => {
    const parsed = parseFloat(rawValue);
    if (!Number.isFinite(parsed)) return;
    onUpdatePart(selectedPart.id, (prev) => {
      const nextVec = { ...prev[transformMode] };
      let val = parsed;
      if (transformMode === 'size') {
        val = Math.max(0.05, Math.min(80, val));
        if (prev.shape === 'Ball') {
          return { ...prev, size: { x: val, y: val, z: val } };
        }
      }
      nextVec[axis] = val;
      return { ...prev, [transformMode]: nextVec };
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Part Name + Quick Actions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={selectedPart.name}
          onChange={(e) =>
            onUpdatePart(selectedPart.id, (prev) => ({ ...prev, name: e.target.value }))
          }
          aria-label="Nome da peça"
          className="flex-1 min-w-0 min-h-[42px] rounded-xl px-3 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
        />
        <button
          type="button"
          onClick={() => onSetPrimaryPart(selectedPart.id)}
          title="Definir como PrimaryPart"
          aria-label="Definir como peça principal"
          className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
            selectedPart.isPrimary
              ? 'bg-amber-400/25 border-amber-500/50 text-amber-600 dark:text-amber-300'
              : 'bg-white/65 dark:bg-white/8 border-slate-900/10 dark:border-white/15 text-slate-500 dark:text-slate-400'
          }`}
        >
          <Star className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicatePart(selectedPart.id)}
          title="Duplicar peça"
          aria-label="Duplicar peça"
          className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-white/65 dark:bg-white/8 border border-slate-900/10 dark:border-white/15 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <CopyPlus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDeletePart(selectedPart.id)}
          title="Excluir peça"
          aria-label="Excluir peça"
          className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-600 dark:text-rose-400 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Color Swatches + Native Picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span>Cor da peça</span>
          <span className="font-code tabular-nums text-slate-500 dark:text-slate-400">
            {selectedPart.color}
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 glass-scroll">
          <label
            className="min-w-[38px] min-h-[38px] rounded-xl border border-slate-900/15 dark:border-white/25 overflow-hidden relative shrink-0 cursor-pointer flex items-center justify-center bg-white dark:bg-slate-800"
            title="Cor personalizada"
          >
            <input
              type="color"
              value={selectedPart.color}
              onChange={(e) =>
                onUpdatePart(selectedPart.id, (prev) => ({
                  ...prev,
                  color: e.target.value.toUpperCase(),
                }))
              }
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              aria-label="Escolher cor personalizada"
            />
            <span
              className="w-6 h-6 rounded-lg border border-black/15"
              style={{ backgroundColor: selectedPart.color }}
            />
          </label>
          {ROBLOX_COLOR_PALETTE.map((swatch) => {
            const isSelected = selectedPart.color.toUpperCase() === swatch.hex.toUpperCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                title={swatch.name}
                aria-label={`Cor ${swatch.name}`}
                onClick={() =>
                  onUpdatePart(selectedPart.id, (prev) => ({ ...prev, color: swatch.hex }))
                }
                className={`min-w-[36px] min-h-[36px] rounded-xl shrink-0 border-2 transition-transform cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 scale-105'
                    : 'border-white/70 dark:border-white/15'
                }`}
                style={{ backgroundColor: swatch.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Shape & Material */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
            Forma
          </label>
          <select
            value={selectedPart.shape}
            onChange={(e) => {
              const nextShape = e.target.value as RobloxShape;
              onUpdatePart(selectedPart.id, (prev) => {
                if (nextShape === 'Ball') {
                  const d = Math.min(prev.size.x, prev.size.y, prev.size.z);
                  return { ...prev, shape: nextShape, size: { x: d, y: d, z: d } };
                }
                return { ...prev, shape: nextShape };
              });
            }}
            className="w-full min-h-[42px] rounded-xl px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none"
          >
            {ROBLOX_SHAPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
            Material
          </label>
          <select
            value={selectedPart.material}
            onChange={(e) =>
              onUpdatePart(selectedPart.id, (prev) => ({
                ...prev,
                material: e.target.value as RobloxMaterial,
              }))
            }
            className="w-full min-h-[42px] rounded-xl px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none"
          >
            {ROBLOX_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transform Segmented Control: Pos / Size / Rot */}
      <div className="space-y-2 rounded-2xl p-2.5 bg-white/50 dark:bg-white/5 border border-slate-900/8 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/8 dark:bg-white/10">
            {(
              [
                { id: 'position', label: 'Mover' },
                { id: 'size', label: 'Tamanho' },
                { id: 'rotation', label: 'Girar' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTransformMode(t.id)}
                className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  transformMode === t.id
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {transformMode !== 'rotation' ? (
            <div className="flex items-center gap-1 text-[11px]">
              {[0.1, 0.25, 0.5].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStepSize(st)}
                  className={`min-h-[30px] px-2 rounded-lg font-code tabular-nums cursor-pointer ${
                    stepSize === st
                      ? 'bg-sky-600 text-white'
                      : 'bg-white/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px]">
              {[0.5, 1].map((st) => {
                const deg = st >= 1 ? 15 : 5;
                return (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setStepSize(st)}
                    className={`min-h-[30px] px-2 rounded-lg font-code tabular-nums cursor-pointer ${
                      (stepSize >= 1 ? 15 : 5) === deg
                        ? 'bg-sky-600 text-white'
                        : 'bg-white/70 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {deg}°
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* X / Y / Z Steppers */}
        <div className="grid grid-cols-3 gap-1.5">
          {(['x', 'y', 'z'] as const).map((axis) => {
            const val = selectedPart[transformMode][axis];
            const axisColor =
              axis === 'x'
                ? 'text-rose-600 dark:text-rose-400'
                : axis === 'y'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-sky-600 dark:text-sky-400';
            return (
              <div
                key={axis}
                className="flex flex-col items-center rounded-xl bg-white/75 dark:bg-slate-900/70 border border-slate-900/8 dark:border-white/10 p-1"
              >
                <span className={`text-[10px] font-bold uppercase ${axisColor}`}>
                  {axis}
                </span>
                <div className="flex items-center justify-between w-full gap-0.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => nudgeAxis(axis, -activeAxisStep)}
                    aria-label={`Diminuir ${axis}`}
                    className="min-w-[32px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-slate-900/8 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    step={activeAxisStep}
                    value={val}
                    onChange={(e) => setAxisDirect(axis, e.target.value)}
                    aria-label={`${transformMode} ${axis}`}
                    className="w-full min-w-0 text-center font-code text-xs tabular-nums text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => nudgeAxis(axis, activeAxisStep)}
                    aria-label={`Aumentar ${axis}`}
                    className="min-w-[32px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-slate-900/8 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transparency & CanCollide */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
          <span className="whitespace-nowrap text-[11px] font-medium">Transparência</span>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.05}
            value={selectedPart.transparency}
            onChange={(e) =>
              onUpdatePart(selectedPart.id, (prev) => ({
                ...prev,
                transparency: Number(e.target.value),
              }))
            }
            className="flex-1 accent-sky-600 cursor-pointer"
          />
          <span className="font-code text-[11px] tabular-nums w-8 text-right">
            {selectedPart.transparency.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdatePart(selectedPart.id, (prev) => ({
              ...prev,
              canCollide: !prev.canCollide,
            }))
          }
          className={`min-h-[36px] px-3 rounded-xl text-[11px] font-semibold border whitespace-nowrap cursor-pointer ${
            selectedPart.canCollide
              ? 'bg-sky-600/15 border-sky-500/40 text-sky-700 dark:text-sky-300'
              : 'bg-white/60 dark:bg-white/8 border-slate-900/10 dark:border-white/15 text-slate-500 dark:text-slate-400'
          }`}
        >
          {selectedPart.canCollide ? 'Colisão: Sim' : 'Colisão: Não'}
        </button>
      </div>

      {/* Contextual AI Edit for this part or whole model */}
      <form onSubmit={handleRefineSubmit} className="pt-1 border-t border-slate-900/8 dark:border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder={`Pedir à IA sobre "${selectedPart.name}"...`}
            className="flex-1 min-h-[42px] rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
          />
          <button
            type="submit"
            disabled={isRefining || !aiInstruction.trim()}
            className="min-h-[42px] px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isRefining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Editar IA</span>
          </button>
        </div>
        {refineError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{refineError}</p>
        ) : null}
      </form>
    </div>
  );
}
