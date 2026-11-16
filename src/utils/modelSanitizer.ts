import {
  RobloxMaterial,
  RobloxModelData,
  RobloxPartData,
  RobloxShape,
} from '../types/robloxModel';

const VALID_SHAPES = new Set<RobloxShape>(['Block', 'Ball', 'Cylinder', 'Wedge']);

const VALID_MATERIALS = new Set<RobloxMaterial>([
  'SmoothPlastic',
  'Plastic',
  'Wood',
  'Metal',
  'Neon',
  'Glass',
  'Fabric',
  'Concrete',
  'Brick',
  'Grass',
  'Sand',
  'Ice',
  'Granite',
  'Marble',
]);

function roundNum(value: unknown, fallback = 0, digits = 3): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
}

export function clampSize(value: unknown, fallback = 1): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return roundNum(Math.max(0.05, Math.min(80, num)));
}

export function sanitizeHexColor(hex: unknown, fallback = '#D48C46'): string {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function sanitizeIdentifier(raw: unknown, fallback = 'RobloxModel'): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  if (!clean) return fallback;
  return /^[0-9]/.test(clean) ? `Model_${clean}` : clean.slice(0, 48);
}

export function sanitizePart(raw: Partial<RobloxPartData>, index: number): RobloxPartData {
  const shape: RobloxShape = VALID_SHAPES.has(raw.shape as RobloxShape)
    ? (raw.shape as RobloxShape)
    : 'Block';

  const material: RobloxMaterial = VALID_MATERIALS.has(raw.material as RobloxMaterial)
    ? (raw.material as RobloxMaterial)
    : 'SmoothPlastic';

  let sx = clampSize(raw.size?.x, 1);
  let sy = clampSize(raw.size?.y, 1);
  let sz = clampSize(raw.size?.z, 1);

  if (shape === 'Ball') {
    const d = Math.min(sx, sy, sz);
    sx = d;
    sy = d;
    sz = d;
  }

  const transparency = roundNum(
    Math.max(0, Math.min(0.95, typeof raw.transparency === 'number' ? raw.transparency : 0)),
    0,
    2
  );

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `part_${index + 1}_${Date.now().toString(36)}`,
    name: sanitizeIdentifier(raw.name, `Part${index + 1}`),
    shape,
    size: { x: sx, y: sy, z: sz },
    position: {
      x: roundNum(raw.position?.x, 0),
      y: roundNum(raw.position?.y, sy * 0.5),
      z: roundNum(raw.position?.z, 0),
    },
    rotation: {
      x: roundNum(raw.rotation?.x, 0, 2),
      y: roundNum(raw.rotation?.y, 0, 2),
      z: roundNum(raw.rotation?.z, 0, 2),
    },
    color: sanitizeHexColor(raw.color),
    material,
    transparency,
    canCollide: typeof raw.canCollide === 'boolean' ? raw.canCollide : true,
    isPrimary: Boolean(raw.isPrimary),
  };
}

/**
 * Ensures the entire model sits cleanly on Y = 0 and has at least one primary part.
 */
export function normalizeModelData(
  raw: Partial<RobloxModelData> & { parts?: Partial<RobloxPartData>[] },
  fallbackPrompt?: string
): RobloxModelData {
  const rawParts = Array.isArray(raw.parts) ? raw.parts : [];
  const parts = rawParts.slice(0, 64).map((p, idx) => sanitizePart(p, idx));

  if (parts.length > 0) {
    // Compute approximate minimum Y across all parts so the model rests cleanly on Y = 0
    let minY = Infinity;
    for (const p of parts) {
      const halfSpanY =
        Math.abs(p.size.y * 0.5 * Math.cos((p.rotation.x * Math.PI) / 180) * Math.cos((p.rotation.z * Math.PI) / 180)) +
        Math.abs(p.size.x * 0.5 * Math.sin((p.rotation.z * Math.PI) / 180)) +
        Math.abs(p.size.z * 0.5 * Math.sin((p.rotation.x * Math.PI) / 180));
      const bottom = p.position.y - Math.max(halfSpanY, p.size.y * 0.25);
      if (bottom < minY) minY = bottom;
    }
    if (Number.isFinite(minY) && Math.abs(minY) > 0.02) {
      for (const p of parts) {
        p.position.y = roundNum(p.position.y - minY);
      }
    }

    if (!parts.some((p) => p.isPrimary)) {
      parts[0].isPrimary = true;
    }
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `model_${Date.now().toString(36)}`,
    name: sanitizeIdentifier(raw.name, 'GeneratedModel'),
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 60)
        : 'Modelo Roblox',
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim().slice(0, 180)
        : 'Modelo 3D gerado para Roblox Studio Lite.',
    parts,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    sourcePrompt: raw.sourcePrompt ?? fallbackPrompt,
  };
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = sanitizeHexColor(hex).slice(1);
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
