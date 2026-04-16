export type ArtKey =
  | 'rose'
  | 'sun'
  | 'moon'
  | 'heart'
  | 'star'
  | 'rooster'
  | 'mermaid'
  | 'skull'
  | 'cactus'
  | 'guitar'
  | 'crown'
  | 'dame'
  | 'bride'
  | 'groom'
  | 'quince'
  | 'grandpa'
  | 'grandma'
  | 'baby';

export type Tone = 'marigold' | 'verde' | 'rose';

export type HeroCard = {
  id: string;
  number: string;
  label: string;
  artKey: ArtKey;
  tone: Tone;
};

export const heroCards: HeroCard[] = [
  // Classic Loteria (12)
  { id: 'la-rosa', number: '01', label: 'La Rosa', artKey: 'rose', tone: 'marigold' },
  { id: 'el-sol', number: '02', label: 'El Sol', artKey: 'sun', tone: 'verde' },
  { id: 'la-luna', number: '03', label: 'La Luna', artKey: 'moon', tone: 'rose' },
  { id: 'el-corazon', number: '04', label: 'El Corazón', artKey: 'heart', tone: 'rose' },
  { id: 'la-estrella', number: '05', label: 'La Estrella', artKey: 'star', tone: 'marigold' },
  { id: 'el-gallo', number: '06', label: 'El Gallo', artKey: 'rooster', tone: 'verde' },
  { id: 'la-sirena', number: '07', label: 'La Sirena', artKey: 'mermaid', tone: 'verde' },
  { id: 'la-calavera', number: '08', label: 'La Calavera', artKey: 'skull', tone: 'rose' },
  { id: 'el-nopal', number: '09', label: 'El Nopal', artKey: 'cactus', tone: 'verde' },
  { id: 'el-musico', number: '10', label: 'El Músico', artKey: 'guitar', tone: 'marigold' },
  { id: 'el-catrin', number: '11', label: 'El Catrín', artKey: 'crown', tone: 'marigold' },
  { id: 'la-dama', number: '12', label: 'La Dama', artKey: 'dame', tone: 'rose' },
  // Event-themed (6)
  { id: 'la-novia', number: '13', label: 'La Novia', artKey: 'bride', tone: 'marigold' },
  { id: 'el-novio', number: '14', label: 'El Novio', artKey: 'groom', tone: 'verde' },
  { id: 'la-quinceanera', number: '15', label: 'La Quinceañera', artKey: 'quince', tone: 'rose' },
  { id: 'el-abuelo', number: '16', label: 'El Abuelo', artKey: 'grandpa', tone: 'marigold' },
  { id: 'la-abuela', number: '17', label: 'La Abuela', artKey: 'grandma', tone: 'verde' },
  { id: 'el-bebe', number: '18', label: 'El Bebé', artKey: 'baby', tone: 'rose' },
];
