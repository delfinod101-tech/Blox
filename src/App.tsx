import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Grid3x3,
  Layers,
  Moon,
  Redo2,
  SlidersHorizontal,
  Sun,
  Undo2,
  Wand2,
} from 'lucide-react';
import { PRESET_MODELS } from './data/presetModels';
import { generateModelLuau } from './luau/generateModelLuau';
import { mountRobloxModelScene, RobloxSceneController } from './three/RobloxModelScene';
import {
  CameraPreset,
  DockTab,
  LuauExportMode,
  RobloxModelData,
  RobloxPartData,
  StudioTheme,
} from './types/robloxModel';
import { sanitizeIdentifier } from './utils/modelSanitizer';
import { CreateModelPanel } from './components/CreateModelPanel';
import { PartEditorPanel } from './components/PartEditorPanel';
import { PartsListPanel } from './components/PartsListPanel';
import { LuauExportPanel } from './components/LuauExportPanel';

const STORAGE_KEY_SAVED = 'bloxcraft_saved_models_v1';
const STORAGE_KEY_THEME = 'bloxcraft_theme_v1';

function loadSavedModels(): RobloxModelData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<RobloxSceneController | null>(null);

  const [theme, setTheme] = useState<StudioTheme>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [isSoftwareGl, setIsSoftwareGl] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  const [model, setModel] = useState<RobloxModelData>(() => PRESET_MODELS[0]);
  const [savedModels, setSavedModels] = useState<RobloxModelData[]>(loadSavedModels);
  const [historyPast, setHistoryPast] = useState<RobloxModelData[]>([]);
  const [historyFuture, setHistoryFuture] = useState<RobloxModelData[]>([]);

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DockTab>('create');
  const [sheetOpen, setSheetOpen] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [exportMode, setExportMode] = useState<LuauExportMode>('anchored');

  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [copiedQuick, setCopiedQuick] = useState(false);

  const luauScript = useMemo(
    () => generateModelLuau(model, exportMode),
    [model, exportMode]
  );

  const selectedPart = useMemo(
    () => model.parts.find((p) => p.id === selectedPartId) ?? null,
    [model.parts, selectedPartId]
  );

  // Apply .dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // ignore storage quota
    }
    controllerRef.current?.setTheme(theme);
  }, [theme]);

  // Persist saved models
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(savedModels.slice(0, 12)));
    } catch {
      // ignore
    }
  }, [savedModels]);

  // Mount Three.js scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const controller = mountRobloxModelScene(
      mount,
      PRESET_MODELS[0],
      theme,
      (partId) => {
        setSelectedPartId(partId);
        if (partId) {
          setActiveTab('edit');
          setSheetOpen(true);
        }
      },
      (lost) => setWebglLost(lost)
    );

    controllerRef.current = controller;
    setIsSoftwareGl(controller.isSoftwareGl);

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync model & selection to Three.js scene
  useEffect(() => {
    controllerRef.current?.setModel(model, selectedPartId);
  }, [model, selectedPartId]);

  useEffect(() => {
    controllerRef.current?.setSelectedPart(selectedPartId);
  }, [selectedPartId]);

  useEffect(() => {
    controllerRef.current?.setShowGrid(showGrid);
  }, [showGrid]);

  // Commit a model mutation with Undo history
  const commitModelChange = useCallback(
    (nextModel: RobloxModelData, clearSelectionIfMissing = true) => {
      setHistoryPast((prev) => [...prev.slice(-24), model]);
      setHistoryFuture([]);
      setModel(nextModel);
      if (
        clearSelectionIfMissing &&
        selectedPartId &&
        !nextModel.parts.some((p) => p.id === selectedPartId)
      ) {
        setSelectedPartId(null);
      }
      // Update saved copy if it exists in savedModels
      setSavedModels((prev) =>
        prev.some((m) => m.id === nextModel.id)
          ? prev.map((m) => (m.id === nextModel.id ? nextModel : m))
          : prev
      );
    },
    [model, selectedPartId]
  );

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [model, ...prev.slice(0, 24)]);
    setModel(previous);
    if (selectedPartId && !previous.parts.some((p) => p.id === selectedPartId)) {
      setSelectedPartId(null);
    }
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-24), model]);
    setModel(next);
  };

  const handleSelectModel = (chosen: RobloxModelData) => {
    commitModelChange(chosen, false);
    setSelectedPartId(null);
    setGenError(null);
    setRefineError(null);
    setTimeout(() => controllerRef.current?.focusSelectedOrCenter(), 30);
  };

  const handleGenerateModel = async (payload: {
    prompt: string;
    imageBase64?: string;
    imageMimeType?: string;
    detailLevel: 'lite' | 'detailed';
  }) => {
    setIsGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao gerar modelo 3D.');
      }
      const generated: RobloxModelData = data.model;
      commitModelChange(generated, false);
      setSelectedPartId(null);
      setSavedModels((prev) => [generated, ...prev.filter((m) => m.id !== generated.id)].slice(0, 12));
      setTimeout(() => controllerRef.current?.focusSelectedOrCenter(), 40);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Erro ao conectar com o servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineWithAI = async (instruction: string) => {
    setIsRefining(true);
    setRefineError(null);
    try {
      const res = await fetch('/api/refine-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentModel: model,
          instruction,
          selectedPartId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível aplicar a edição.');
      }
      const updated: RobloxModelData = data.model;
      commitModelChange(updated, true);
      setSavedModels((prev) => [updated, ...prev.filter((m) => m.id !== updated.id)].slice(0, 12));
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'Erro ao editar com IA.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleUpdatePart = (
    partId: string,
    updater: (prev: RobloxPartData) => RobloxPartData
  ) => {
    const nextParts = model.parts.map((p) => (p.id === partId ? updater(p) : p));
    commitModelChange({ ...model, parts: nextParts }, false);
  };

  const handleDuplicatePart = (partId: string) => {
    const source = model.parts.find((p) => p.id === partId);
    if (!source) return;
    const copy: RobloxPartData = {
      ...source,
      id: `part_${Date.now().toString(36)}`,
      name: `${source.name}Copia`,
      isPrimary: false,
      position: {
        x: Math.round((source.position.x + 0.5) * 100) / 100,
        y: source.position.y,
        z: source.position.z,
      },
    };
    commitModelChange({ ...model, parts: [...model.parts, copy] }, false);
    setSelectedPartId(copy.id);
  };

  const handleDeletePart = (partId: string) => {
    if (model.parts.length <= 1) return;
    const remaining = model.parts.filter((p) => p.id !== partId);
    if (!remaining.some((p) => p.isPrimary) && remaining.length > 0) {
      remaining[0] = { ...remaining[0], isPrimary: true };
    }
    commitModelChange({ ...model, parts: remaining }, true);
    if (selectedPartId === partId) {
      setSelectedPartId(null);
    }
  };

  const handleSetPrimaryPart = (partId: string) => {
    const nextParts = model.parts.map((p) => ({
      ...p,
      isPrimary: p.id === partId,
    }));
    commitModelChange({ ...model, parts: nextParts }, false);
  };

  const handleAddPart = () => {
    const newPart: RobloxPartData = {
      id: `part_${Date.now().toString(36)}`,
      name: `Peca${model.parts.length + 1}`,
      shape: 'Block',
      size: { x: 1, y: 1, z: 1 },
      position: { x: 0, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#2B7DE9',
      material: 'SmoothPlastic',
      transparency: 0,
      canCollide: true,
      isPrimary: false,
    };
    commitModelChange({ ...model, parts: [...model.parts, newPart] }, false);
    setSelectedPartId(newPart.id);
    setActiveTab('edit');
    setSheetOpen(true);
  };

  const handleRenameModel = (title: string) => {
    const next: RobloxModelData = {
      ...model,
      title,
      name: sanitizeIdentifier(title, 'RobloxModel'),
    };
    setModel(next);
  };

  const handleDeleteSaved = (id: string) => {
    setSavedModels((prev) => prev.filter((m) => m.id !== id));
  };

  const handleQuickCopyLuau = async () => {
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
    setCopiedQuick(true);
    setTimeout(() => setCopiedQuick(false), 1800);
  };

  const handleTabPress = (tab: DockTab) => {
    if (activeTab === tab && sheetOpen) {
      setSheetOpen(false);
    } else {
      setActiveTab(tab);
      setSheetOpen(true);
    }
  };

  const handleCameraPreset = (preset: CameraPreset) => {
    controllerRef.current?.setCameraPreset(preset);
  };

  return (
    <div
      className={`relative w-screen h-[100dvh] overflow-hidden select-none ${
        isSoftwareGl ? 'no-blur-gl' : ''
      } ${theme === 'dark' ? 'bg-[#0b1120] text-slate-100' : 'bg-[#e9eff8] text-slate-900'}`}
    >
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {webglLost ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none">
          <div className="liquid-glass rounded-3xl px-5 py-4 text-center max-w-xs">
            <p className="text-sm font-semibold">Contexto 3D pausado</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              O navegador liberou memória gráfica. Recarregue a página para restaurar.
            </p>
          </div>
        </div>
      ) : null}

      {/* Top Liquid Glass Header (Compact <= 54px, 3 zones) */}
      <header className="fixed top-2.5 left-2.5 right-2.5 lg:left-5 lg:right-5 z-20 pointer-events-none pt-safe">
        <div className="liquid-glass rounded-[22px] px-3.5 py-1.5 flex items-center justify-between gap-4 pointer-events-auto max-w-7xl mx-auto">
          {/* Zone 1: Brand Wordmark */}
          <span className="font-display text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0">
            BloxCraft
          </span>

          {/* Zone 2: Quiet Model Status Text (unboxed, zero pills) */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 truncate min-w-0">
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {model.title}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums whitespace-nowrap shrink-0">
              {model.parts.length} peças
            </span>
          </div>

          {/* Zone 3: Theme Switch + Primary Copy Luau CTA */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-900/8 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300" />
              )}
            </button>

            <button
              type="button"
              onClick={handleQuickCopyLuau}
              className="min-h-[40px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 active:scale-[0.97] transition-all cursor-pointer"
            >
              {copiedQuick ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedQuick ? 'Copiado!' : 'Copiar Lua'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Discreet Viewport Quick Controls (Top-Left below header) */}
      <div className="fixed top-[68px] left-2.5 lg:left-5 z-10 flex flex-wrap items-center gap-1.5 pointer-events-auto">
        <div className="liquid-glass-subtle rounded-2xl p-1 flex items-center gap-0.5">
          {(
            [
              { id: 'iso', label: '3/4' },
              { id: 'front', label: 'Frente' },
              { id: 'side', label: 'Lado' },
              { id: 'top', label: 'Topo' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => handleCameraPreset(cam.id)}
              className="min-h-[34px] px-2.5 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/12 transition-colors whitespace-nowrap cursor-pointer"
            >
              {cam.label}
            </button>
          ))}
        </div>

        <div className="liquid-glass-subtle rounded-2xl p-1 flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            aria-label="Desfazer"
            className="min-w-[36px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/12 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            aria-label="Refazer"
            className="min-w-[36px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/12 disabled:opacity-35 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            aria-label="Alternar grade"
            aria-pressed={showGrid}
            className={`min-w-[36px] min-h-[34px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              showGrid
                ? 'bg-sky-600/15 text-sky-600 dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sheet / Desktop Right Dock (iOS Liquid Glass) */}
      <aside
        aria-label="Painel de modelagem e script"
        className="fixed z-20 left-2.5 right-2.5 bottom-2.5 lg:left-auto lg:right-5 lg:top-[68px] lg:bottom-5 lg:w-[410px] flex flex-col justify-end pointer-events-none pb-safe lg:pb-0"
      >
        {/* Expandable Glass Sheet Content */}
        {sheetOpen ? (
          <div className="liquid-glass rounded-[26px] mb-2 lg:mb-2.5 overflow-hidden flex flex-col max-h-[54dvh] lg:max-h-full lg:flex-1 pointer-events-auto">
            {/* Sheet Top Handle & Title Row */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-900/8 dark:border-white/10 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {activeTab === 'create' && 'Criar Modelo 3D'}
                  {activeTab === 'edit' &&
                    (selectedPart ? `Editando: ${selectedPart.name}` : 'Editor de Peças')}
                  {activeTab === 'parts' && `${model.title} · ${model.parts.length} peças`}
                  {activeTab === 'luau' && 'Script Luau · Studio Lite'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Recolher painel"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-slate-900/8 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-3.5 overflow-y-auto glass-scroll select-text">
              {activeTab === 'create' && (
                <CreateModelPanel
                  isGenerating={isGenerating}
                  errorMessage={genError}
                  presets={PRESET_MODELS}
                  savedModels={savedModels}
                  activeModelId={model.id}
                  onGenerate={handleGenerateModel}
                  onSelectModel={handleSelectModel}
                  onDeleteSaved={handleDeleteSaved}
                />
              )}

              {activeTab === 'edit' && (
                <PartEditorPanel
                  selectedPart={selectedPart}
                  totalParts={model.parts.length}
                  isRefining={isRefining}
                  refineError={refineError}
                  onUpdatePart={handleUpdatePart}
                  onDuplicatePart={handleDuplicatePart}
                  onDeletePart={handleDeletePart}
                  onSetPrimaryPart={handleSetPrimaryPart}
                  onAddPart={handleAddPart}
                  onRefineWithAI={handleRefineWithAI}
                  onOpenPartsTab={() => setActiveTab('parts')}
                />
              )}

              {activeTab === 'parts' && (
                <PartsListPanel
                  model={model}
                  selectedPartId={selectedPartId}
                  onSelectPart={(id) => {
                    setSelectedPartId(id);
                    setActiveTab('edit');
                  }}
                  onDeletePart={handleDeletePart}
                  onAddPart={handleAddPart}
                  onRenameModel={handleRenameModel}
                />
              )}

              {activeTab === 'luau' && (
                <LuauExportPanel
                  model={model}
                  luauScript={luauScript}
                  exportMode={exportMode}
                  onChangeMode={setExportMode}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center mb-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="liquid-glass-subtle rounded-2xl px-4 min-h-[38px] text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>
                {selectedPart ? `Editar ${selectedPart.name}` : `${model.title} · Abrir Painel`}
              </span>
            </button>
          </div>
        )}

        {/* Fixed Bottom Thumb-Zone Tab Bar (Liquid Glass) */}
        <nav
          aria-label="Navegação do estúdio"
          className="liquid-glass rounded-[24px] p-1.5 grid grid-cols-4 gap-1 pointer-events-auto shrink-0"
        >
          {(
            [
              { id: 'create', label: 'Criar', icon: Wand2 },
              { id: 'edit', label: 'Editar', icon: SlidersHorizontal },
              { id: 'parts', label: 'Peças', icon: Layers },
              { id: 'luau', label: 'Luau', icon: Code2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && sheetOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabPress(item.id)}
                className={`min-h-[48px] rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-[0.96] ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/8'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
