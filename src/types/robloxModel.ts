export type RobloxShape = 'Block' | 'Ball' | 'Cylinder' | 'Wedge';

export type RobloxMaterial =
  | 'SmoothPlastic'
  | 'Plastic'
  | 'Wood'
  | 'Metal'
  | 'Neon'
  | 'Glass'
  | 'Fabric'
  | 'Concrete'
  | 'Brick'
  | 'Grass'
  | 'Sand'
  | 'Ice'
  | 'Granite'
  | 'Marble';

export const ROBLOX_SHAPES: { id: RobloxShape; label: string }[] = [
  { id: 'Block', label: 'Bloco' },
  { id: 'Ball', label: 'Esfera' },
  { id: 'Cylinder', label: 'Cilindro' },
  { id: 'Wedge', label: 'Rampa' },
];

export const ROBLOX_MATERIALS: { id: RobloxMaterial; label: string }[] = [
  { id: 'SmoothPlastic', label: 'Plástico Liso' },
  { id: 'Plastic', label: 'Plástico' },
  { id: 'Neon', label: 'Neon' },
  { id: 'Metal', label: 'Metal' },
  { id: 'Glass', label: 'Vidro' },
  { id: 'Wood', label: 'Madeira' },
  { id: 'Fabric', label: 'Tecido' },
  { id: 'Grass', label: 'Grama' },
  { id: 'Brick', label: 'Tijolo' },
  { id: 'Concrete', label: 'Concreto' },
  { id: 'Sand', label: 'Areia' },
  { id: 'Ice', label: 'Gelo' },
  { id: 'Granite', label: 'Granito' },
  { id: 'Marble', label: 'Mármore' },
];

export const ROBLOX_COLOR_PALETTE: { name: string; hex: string }[] = [
  { name: 'Caramelo', hex: '#D48C46' },
  { name: 'Creme', hex: '#F3D2A2' },
  { name: 'Marrom Escuro', hex: '#5A3821' },
  { name: 'Branco', hex: '#F4F6F8' },
  { name: 'Cinza Claro', hex: '#B4BCC6' },
  { name: 'Grafite', hex: '#383E4A' },
  { name: 'Preto', hex: '#181B22' },
  { name: 'Vermelho', hex: '#E13B3B' },
  { name: 'Laranja', hex: '#F58220' },
  { name: 'Amarelo', hex: '#F6C935' },
  { name: 'Verde', hex: '#3CB865' },
  { name: 'Ciano', hex: '#14B8D4' },
  { name: 'Azul', hex: '#2B7DE9' },
  { name: 'Roxo', hex: '#8D52E8' },
  { name: 'Rosa', hex: '#F062A6' },
  { name: 'Dourado', hex: '#F3B73F' },
];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RobloxPartData {
  id: string;
  name: string;
  shape: RobloxShape;
  size: Vec3;
  position: Vec3;
  rotation: Vec3;
  color: string;
  material: RobloxMaterial;
  transparency: number;
  canCollide: boolean;
  isPrimary?: boolean;
}

export interface RobloxModelData {
  id: string;
  name: string;
  title: string;
  description: string;
  parts: RobloxPartData[];
  createdAt: number;
  sourcePrompt?: string;
}

export type LuauExportMode = 'anchored' | 'welded';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';
export type DockTab = 'create' | 'edit' | 'parts' | 'luau';
export type StudioTheme = 'light' | 'dark';
