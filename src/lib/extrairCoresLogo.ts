export interface PaletaLogo { principal: string; destaque: string; }

type Cor = { r: number; g: number; b: number; quantidade: number; saturacao: number; luminosidade: number; matiz: number };

export async function extrairCoresLogo(file: File): Promise<PaletaLogo> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const escala = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível analisar as cores da logo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const grupos = new Map<string, { r: number; g: number; b: number; quantidade: number }>();
  for (let i = 0; i < pixels.length; i += 16) {
    const alpha = pixels[i + 3];
    if (alpha < 180) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 242 && min > 242) continue;
    if (max < 22) continue;
    const qr = Math.round(r / 24) * 24, qg = Math.round(g / 24) * 24, qb = Math.round(b / 24) * 24;
    const chave = `${qr},${qg},${qb}`;
    const atual = grupos.get(chave) ?? { r: 0, g: 0, b: 0, quantidade: 0 };
    atual.r += r; atual.g += g; atual.b += b; atual.quantidade++;
    grupos.set(chave, atual);
  }

  const cores: Cor[] = Array.from(grupos.values()).map((grupo) => {
    const r = Math.round(grupo.r / grupo.quantidade), g = Math.round(grupo.g / grupo.quantidade), b = Math.round(grupo.b / grupo.quantidade);
    const hsl = rgbParaHsl(r, g, b);
    return { r, g, b, quantidade: grupo.quantidade, ...hsl };
  }).filter((cor) => cor.saturacao > 0.16 && cor.luminosidade > 0.12 && cor.luminosidade < 0.88)
    .sort((a, b) => (b.quantidade * (0.45 + b.saturacao)) - (a.quantidade * (0.45 + a.saturacao)));

  if (!cores.length) return { principal: '#334155', destaque: '#94A3B8' };
  const principal = cores[0];
  const destaque = cores.find((cor) => distanciaMatiz(principal.matiz, cor.matiz) > 35 && distanciaRgb(principal, cor) > 90) ?? cores.find((cor) => distanciaRgb(principal, cor) > 75) ?? clarear(principal);
  return { principal: paraHex(principal), destaque: paraHex(destaque) };
}

function rgbParaHsl(r: number, g: number, b: number) {
  const rn=r/255,gn=g/255,bn=b/255,max=Math.max(rn,gn,bn),min=Math.min(rn,gn,bn),d=max-min;
  let h=0;if(d){if(max===rn)h=((gn-bn)/d)%6;else if(max===gn)h=(bn-rn)/d+2;else h=(rn-gn)/d+4;h*=60;if(h<0)h+=360;}
  const l=(max+min)/2;const s=d===0?0:d/(1-Math.abs(2*l-1));return { matiz:h,saturacao:s,luminosidade:l };
}
function distanciaMatiz(a:number,b:number){const d=Math.abs(a-b);return Math.min(d,360-d);}
function distanciaRgb(a:Cor,b:Cor){return Math.hypot(a.r-b.r,a.g-b.g,a.b-b.b);}
function paraHex(c:{r:number;g:number;b:number}){return `#${[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`.toUpperCase();}
function clarear(c:Cor):Cor{return {...c,r:Math.min(255,c.r+80),g:Math.min(255,c.g+80),b:Math.min(255,c.b+80)};}
