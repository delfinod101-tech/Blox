import { LuauExportMode, RobloxModelData, RobloxPartData } from '../types/robloxModel';
import { hexToRgbTuple, sanitizeIdentifier } from '../utils/modelSanitizer';

function fmt(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

function buildPartLine(part: RobloxPartData, idx: number, anchored: boolean): string {
  const [r, g, b] = hexToRgbTuple(part.color);
  const className = part.shape === 'Wedge' ? 'WedgePart' : 'Part';
  const shapeProp =
    part.shape !== 'Wedge' ? `\n\tp.Shape = Enum.PartType.${part.shape}` : '';

  const px = fmt(part.position.x);
  const py = fmt(part.position.y);
  const pz = fmt(part.position.z);
  const rx = fmt(part.rotation.x);
  const ry = fmt(part.rotation.y);
  const rz = fmt(part.rotation.z);
  const sx = fmt(part.size.x);
  const sy = fmt(part.size.y);
  const sz = fmt(part.size.z);

  const hasRotation =
    Math.abs(part.rotation.x) > 0.001 ||
    Math.abs(part.rotation.y) > 0.001 ||
    Math.abs(part.rotation.z) > 0.001;

  const cfExpr = hasRotation
    ? `originCF * CFrame.new(${px}, ${py}, ${pz}) * CFrame.Angles(math.rad(${rx}), math.rad(${ry}), math.rad(${rz}))`
    : `originCF * CFrame.new(${px}, ${py}, ${pz})`;

  const transparencyLine =
    part.transparency > 0.001 ? `\n\tp.Transparency = ${fmt(part.transparency)}` : '';

  return `\t-- ${idx + 1}. ${part.name}
\tdo
\t\tlocal p = Instance.new("${className}")
\t\tp.Name = "${sanitizeIdentifier(part.name, `Part${idx + 1}`)}"${shapeProp}
\t\tp.Size = Vector3.new(${sx}, ${sy}, ${sz})
\t\tp.CFrame = ${cfExpr}
\t\tp.Color = Color3.fromRGB(${r}, ${g}, ${b})
\t\tp.Material = Enum.Material.${part.material}${transparencyLine}
\t\tp.Anchored = ${anchored ? 'true' : 'false'}
\t\tp.CanCollide = ${part.canCollide ? 'true' : 'false'}
\t\tp.TopSurface = Enum.SurfaceType.Smooth
\t\tp.BottomSurface = Enum.SurfaceType.Smooth
\t\tp.Parent = model${part.isPrimary ? '\n\t\tprimaryPart = p' : ''}
\t\ttable.insert(parts, p)
\tend`;
}

export function generateModelLuau(
  model: RobloxModelData,
  mode: LuauExportMode = 'anchored'
): string {
  const safeName = sanitizeIdentifier(model.name, 'BloxCraftModel');
  const anchored = mode === 'anchored';

  const partsCode = model.parts
    .map((part, idx) => buildPartLine(part, idx, anchored))
    .join('\n\n');

  const weldBlock =
    mode === 'welded'
      ? `
-- Soldagem automatica (WeldConstraint) para mover o modelo inteiro sem desmontar
if primaryPart then
\tmodel.PrimaryPart = primaryPart
\tfor _, p in ipairs(parts) do
\t\tif p ~= primaryPart then
\t\t\tlocal weld = Instance.new("WeldConstraint")
\t\t\tweld.Part0 = primaryPart
\t\t\tweld.Part1 = p
\t\t\tweld.Parent = p
\t\tend
\tend
\tprimaryPart.Anchored = true -- Mude para false se quiser fisica/movimento livre
end`
      : `
if primaryPart then
\tmodel.PrimaryPart = primaryPart
end`;

  return `--==================================================
-- ${model.title} | Gerado no BloxCraft Studio Lite
-- Total de pecas: ${model.parts.length} | Modo: ${anchored ? 'Ancorado (Estatico)' : 'Soldado (WeldConstraint)'}
-- Como usar no Roblox Studio Lite / Studio:
-- Cole em um Script no ServerScriptService, Workspace ou na Barra de Comando
--==================================================

local SPAWN_POSITION = Vector3.new(0, 0, 0) -- Altere para onde o modelo deve aparecer
local originCF = CFrame.new(SPAWN_POSITION)

local existing = workspace:FindFirstChild("${safeName}")
if existing then
\texisting:Destroy()
end

local model = Instance.new("Model")
model.Name = "${safeName}"

local parts = {}
local primaryPart = nil

${partsCode}
${weldBlock}

model.Parent = workspace
print("[BloxCraft] Modelo '${safeName}' criado com " .. #parts .. " pecas!")
`;
}
