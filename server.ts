import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { normalizeModelData } from './src/utils/modelSanitizer.js';
import { RobloxModelData } from './src/types/robloxModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODEL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: 'Identificador PascalCase sem espacos ou acentos para Model.Name no Roblox (ex: CachorroCaramelo)',
    },
    title: {
      type: Type.STRING,
      description: 'Titulo curto em portugues para exibir ao usuario (ex: Cachorro Caramelo)',
    },
    description: {
      type: Type.STRING,
      description: 'Breve descricao de 1 frase em portugues do modelo criado',
    },
    parts: {
      type: Type.ARRAY,
      description: 'Lista de 10 a 32 pecas 3D que formam o modelo completo e proporcional',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING, description: 'Nome da peca sem espacos (ex: Torso, OrelhaEsq, RodaFrente)' },
          shape: {
            type: Type.STRING,
            description: 'Forma exata do Roblox: Block, Ball, Cylinder ou Wedge',
          },
          size: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
            },
            required: ['x', 'y', 'z'],
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
            },
            required: ['x', 'y', 'z'],
          },
          rotation: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
            },
            required: ['x', 'y', 'z'],
          },
          color: {
            type: Type.STRING,
            description: 'Cor em hexadecimal #RRGGBB',
          },
          material: {
            type: Type.STRING,
            description:
              'Material Roblox: SmoothPlastic, Plastic, Wood, Metal, Neon, Glass, Fabric, Concrete, Brick, Grass, Sand, Ice, Granite ou Marble',
          },
          transparency: {
            type: Type.NUMBER,
            description: 'Transparencia de 0 (solido) a 0.9',
          },
          canCollide: {
            type: Type.BOOLEAN,
          },
          isPrimary: {
            type: Type.BOOLEAN,
          },
        },
        required: ['name', 'shape', 'size', 'position', 'rotation', 'color', 'material', 'transparency', 'canCollide'],
      },
    },
  },
  required: ['name', 'title', 'description', 'parts'],
};

const SYSTEM_PROMPT = `Voce e um mestre modelador 3D de Roblox Studio / Roblox Studio Lite.
Sua tarefa e projetar modelos 3D compostos por pecas (Parts / WedgeParts) com proporcoes perfeitas, silhueta imediatamente reconhecivel, cores harmonicas e zero pecas flutuando sem conexao.

REGRAS GEOMETRICAS EXATAS DO ROBLOX (OBRIGATORIAS):
1. Sistema de coordenadas:
   - +Y = para cima. O chao (baseplate) fica em Y = 0. O modelo inteiro deve apoiar os pes/rodas/base em Y = 0!
   - +Z = frente do modelo (olhando para o usuario). -Z = tras.
   - +X = direita, -X = esquerda.
2. Formas (shape):
   - "Block": caixa retangular centrada em position com tamanho (size.x, size.y, size.z).
   - "Ball": esfera uniforme cujo diametro e min(size.x, size.y, size.z). Use x = y = z para esferas (olhos, nariz, cabecas redondas, frutos).
   - "Cylinder": ATENCAO! No Roblox, o eixo do cilindro e ao longo do eixo LOCAL X (size.x = comprimento do cilindro, size.y = size.z = diametro).
     * Para cilindro em pe (vertical como tronco/pilar/garrafa): use rotation.z = 90 (com size.x = altura, size.y = size.z = diametro).
     * Para cilindro apontando para frente (+Z, como cano/lanterna): use rotation.y = 90.
     * Para roda lateral (eixo X): rotation = (0,0,0), size.x = largura da roda, size.y = size.z = diametro.
   - "Wedge": rampa triangular. A parede vertical fica em +Z e a ponta baixa em -Z.
3. Qualidade visual & detalhes:
   - Crie entre 12 e 28 pecas bem conectadas (com leve encaixe de 0.05 a 0.15 studs entre pecas adjacentes para nunca parecerem separadas).
   - Para animais/personagens (ex: cachorro, gato, dragao, robo): inclua torso, pescoco, cabeca, focinho/rosto, olhos, orelhas, 4 patas com pesinhos, rabo e acessorios (ex: coleira, detalhes).
   - Para objetos/veiculos/construcoes: inclua estrutura principal, detalhes secundarios, acentos de cor e materiais variados (SmoothPlastic, Metal, Neon, Glass, Wood, Fabric).
   - Marque exatamente 1 peca principal como isPrimary: true.
   - Retorne APENAS JSON valido conforme o schema.`;

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/429|RESOURCE_EXHAUSTED/i.test(raw)) {
    return {
      status: 429,
      message: 'Limite temporário de requisições da IA atingido. Aguarde alguns segundos e tente novamente.',
    };
  }
  if (/403|PERMISSION_DENIED|API_KEY_INVALID|400/i.test(raw)) {
    return {
      status: 400,
      message: 'Chave da API Gemini ausente ou inválida. Verifique Settings > Secrets no painel.',
    };
  }
  return {
    status: 500,
    message: 'Não foi possível gerar o modelo agora. Tente descrever com outras palavras.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/generate-model', async (req, res) => {
    try {
      const { prompt, imageBase64, imageMimeType, detailLevel } = req.body as {
        prompt?: string;
        imageBase64?: string;
        imageMimeType?: string;
        detailLevel?: 'lite' | 'detailed';
      };

      const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 20;

      if (!cleanPrompt && !hasImage) {
        res.status(400).json({ error: 'Escreva o que deseja modelar ou envie uma imagem de referência.' });
        return;
      }

      const ai = getAiClient();
      const targetRange = detailLevel === 'lite' ? '8 a 15 pecas (otimizado para mobile/Studio Lite)' : '14 a 28 pecas bem detalhadas';

      const userInstruction = hasImage
        ? `Analise a imagem de referencia enviada com muita atencao (silhueta, proporcoes, cores e partes principais). ${
            cleanPrompt
              ? `Pedido do usuario com a imagem: "${cleanPrompt}".`
              : 'Recrie o sujeito/objeto da imagem fielmente como um modelo 3D para Roblox Studio.'
          } Gere ${targetRange}.`
        : `Crie um modelo 3D completo para Roblox Studio Lite baseado neste pedido: "${cleanPrompt}". Gere ${targetRange}, com pecas bem conectadas e proporcoes fiéis.`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (hasImage && imageBase64) {
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        parts.push({
          inlineData: {
            mimeType: imageMimeType && imageMimeType.startsWith('image/') ? imageMimeType : 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: userInstruction });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: MODEL_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MEDIUM,
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Resposta vazia da IA');
      }

      const parsed = JSON.parse(rawText);
      const model = normalizeModelData(parsed, cleanPrompt || 'Modelo por imagem de referência');

      if (model.parts.length === 0) {
        throw new Error('Nenhuma peça válida gerada');
      }

      res.json({ model });
    } catch (err) {
      console.error('[generate-model error]', err);
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/refine-model', async (req, res) => {
    try {
      const { currentModel, instruction, selectedPartId, imageBase64, imageMimeType } = req.body as {
        currentModel?: RobloxModelData;
        instruction?: string;
        selectedPartId?: string | null;
        imageBase64?: string;
        imageMimeType?: string;
      };

      const cleanInstruction = typeof instruction === 'string' ? instruction.trim() : '';
      if (!currentModel || !Array.isArray(currentModel.parts) || !cleanInstruction) {
        res.status(400).json({ error: 'Envie o modelo atual e o que deseja alterar.' });
        return;
      }

      const ai = getAiClient();
      const selectedPart = selectedPartId
        ? currentModel.parts.find((p) => p.id === selectedPartId)
        : undefined;

      const textPrompt = `Aqui esta o modelo 3D Roblox atual em JSON:
${JSON.stringify({
  name: currentModel.name,
  title: currentModel.title,
  description: currentModel.description,
  parts: currentModel.parts,
})}

${selectedPart ? `O usuario selecionou atualmente a peca "${selectedPart.name}" (id: "${selectedPart.id}").` : ''}
Instrucao de edicao do usuario: "${cleanInstruction}"

Aplique exatamente essa modificacao (pode alterar cores, tamanhos, posicoes, adicionar novas pecas ou remover pecas indesejadas), mantendo as demais pecas que nao precisam mudar coerentes e conectadas. Retorne o modelo atualizado completo no mesmo formato JSON.`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64 && imageBase64.length > 20) {
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        parts.push({
          inlineData: {
            mimeType: imageMimeType && imageMimeType.startsWith('image/') ? imageMimeType : 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: textPrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: MODEL_RESPONSE_SCHEMA,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);
      const updated = normalizeModelData(
        { ...parsed, id: currentModel.id },
        cleanInstruction
      );

      res.json({ model: updated });
    } catch (err) {
      console.error('[refine-model error]', err);
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BloxCraft Studio Lite server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
