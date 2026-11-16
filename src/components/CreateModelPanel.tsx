import { ChangeEvent, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Wand2, X } from 'lucide-react';
import { RobloxModelData } from '../types/robloxModel';
import { PreparedImage, prepareReferenceImage } from '../utils/imageResize';

interface CreateModelPanelProps {
  isGenerating: boolean;
  errorMessage: string | null;
  presets: RobloxModelData[];
  savedModels: RobloxModelData[];
  activeModelId: string;
  onGenerate: (payload: {
    prompt: string;
    imageBase64?: string;
    imageMimeType?: string;
    detailLevel: 'lite' | 'detailed';
  }) => void;
  onSelectModel: (model: RobloxModelData) => void;
  onDeleteSaved: (id: string) => void;
}

const PROMPT_SUGGESTIONS = [
  'Cachorro husky fofo com coleira azul',
  'Espada medieval dourada com gema neon',
  'Gatinho sentado com laço rosa',
  'Moto futurista com rodas neon',
  'Árvore de cerejeira estilizada',
];

export function CreateModelPanel({
  isGenerating,
  errorMessage,
  presets,
  savedModels,
  activeModelId,
  onGenerate,
  onSelectModel,
  onDeleteSaved,
}: CreateModelPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [detailLevel, setDetailLevel] = useState<'lite' | 'detailed'>('detailed');
  const [refImage, setRefImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    try {
      const prepared = await prepareReferenceImage(file, 1024);
      setRefImage(prepared);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !refImage) || isGenerating) return;
    onGenerate({
      prompt: prompt.trim(),
      imageBase64: refImage?.base64,
      imageMimeType: refImage?.mimeType,
      detailLevel,
    });
  };

  return (
    <div className="space-y-4">
      {/* Prompt & Reference Image Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="model-prompt"
            className="text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            O que você quer criar no Roblox?
          </label>
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/8 dark:bg-white/10">
            <button
              type="button"
              onClick={() => setDetailLevel('lite')}
              className={`min-h-[30px] px-2.5 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                detailLevel === 'lite'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Leve
            </button>
            <button
              type="button"
              onClick={() => setDetailLevel('detailed')}
              className={`min-h-[30px] px-2.5 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                detailLevel === 'detailed'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Detalhado
            </button>
          </div>
        </div>

        <textarea
          id="model-prompt"
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            refImage
              ? 'Ex: Faz igual a foto, estilo low-poly Roblox com coleira neon...'
              : 'Ex: Faz um cachorro pastor alemão sentado ou um carro esportivo...'
          }
          className="w-full rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white/75 dark:bg-slate-900/70 border border-slate-900/10 dark:border-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500/60 resize-none"
        />

        {/* Reference Image Preview or Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Selecionar imagem de referência"
        />

        {refImage ? (
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/65 dark:bg-slate-900/60 border border-slate-900/10 dark:border-white/12">
            <img
              src={refImage.dataUrl}
              alt="Referência selecionada"
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-xl object-cover shrink-0 border border-black/10 dark:border-white/10"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                Imagem de referência pronta
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                A IA vai copiar formas e cores desta imagem
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRefImage(null)}
              aria-label="Remover imagem"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {imageError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{imageError}</p>
        ) : null}

        {errorMessage ? (
          <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="min-h-[46px] px-3.5 rounded-2xl bg-white/75 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-slate-900/10 dark:border-white/15 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{refImage ? 'Trocar Foto' : 'Usar Imagem'}</span>
          </button>

          <button
            type="submit"
            disabled={isGenerating || (!prompt.trim() && !refImage)}
            className="flex-1 min-h-[46px] px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando 3D...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Gerar Model</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Prompt Suggestions */}
      <div>
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
          Ideias rápidas
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 glass-scroll">
          {PROMPT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/65 dark:bg-white/8 hover:bg-white dark:hover:bg-white/14 border border-slate-900/8 dark:border-white/12 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Presets & Saved Models */}
      <div className="space-y-2 pt-1 border-t border-slate-900/8 dark:border-white/10">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Modelos prontos e salvos
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {savedModels.map((m) => {
            const active = m.id === activeModelId;
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 border transition-colors ${
                  active
                    ? 'bg-sky-500/12 border-sky-500/40'
                    : 'bg-white/55 dark:bg-white/6 border-slate-900/8 dark:border-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectModel(m)}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {m.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Salvo · {m.parts.length} peças
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSaved(m.id)}
                  aria-label={`Remover ${m.title}`}
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {presets.map((m) => {
            const active = m.id === activeModelId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectModel(m)}
                className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-500/12 border-sky-500/40'
                    : 'bg-white/55 dark:bg-white/6 hover:bg-white/80 dark:hover:bg-white/12 border-slate-900/8 dark:border-white/10'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {m.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Exemplo · {m.parts.length} peças
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
