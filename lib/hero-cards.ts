import type { StaticImageData } from 'next/image';

import weddingCouple from './hero-cards-illustrations/01-wedding-couple.webp';
import weddingBouquet from './hero-cards-illustrations/02-wedding-bouquet.webp';
import weddingRings from './hero-cards-illustrations/03-wedding-rings.webp';
import quinceanera from './hero-cards-illustrations/04-quinceanera.webp';
import birthdayCandles from './hero-cards-illustrations/05-birthday-candles.webp';
import christmasTree from './hero-cards-illustrations/06-christmas-tree.webp';
import family from './hero-cards-illustrations/07-family-portrait.webp';
import baby from './hero-cards-illustrations/08-baby.webp';
import grandpa from './hero-cards-illustrations/09-grandpa.webp';
import grandma from './hero-cards-illustrations/10-grandma.webp';
import dog from './hero-cards-illustrations/11-dog.webp';
import cat from './hero-cards-illustrations/12-cat.webp';
import house from './hero-cards-illustrations/13-house.webp';
import car from './hero-cards-illustrations/14-car.webp';
import guitar from './hero-cards-illustrations/15-guitar.webp';
import soccerBall from './hero-cards-illustrations/16-soccer-ball.webp';
import camera from './hero-cards-illustrations/17-camera.webp';
import tacos from './hero-cards-illustrations/18-tacos.webp';

export type HeroCard = {
  id: string;
  number: string;
  label: string;
  image: StaticImageData;
};

export const heroCards: HeroCard[] = [
  { id: 'la-boda', number: '01', label: 'La Boda', image: weddingCouple },
  { id: 'el-ramo', number: '02', label: 'El Ramo', image: weddingBouquet },
  { id: 'los-anillos', number: '03', label: 'Los Anillos', image: weddingRings },
  { id: 'la-quinceanera', number: '04', label: 'La Quinceañera', image: quinceanera },
  { id: 'el-cumpleanos', number: '05', label: 'El Cumpleaños', image: birthdayCandles },
  { id: 'arbol-navideno', number: '06', label: 'Árbol navideño', image: christmasTree },
  { id: 'la-familia', number: '07', label: 'La Familia', image: family },
  { id: 'el-bebe', number: '08', label: 'El Bebé', image: baby },
  { id: 'el-abuelo', number: '09', label: 'El Abuelo', image: grandpa },
  { id: 'la-abuela', number: '10', label: 'La Abuela', image: grandma },
  { id: 'el-perro', number: '11', label: 'El Perro', image: dog },
  { id: 'el-gato', number: '12', label: 'El Gato', image: cat },
  { id: 'la-casa', number: '13', label: 'La Casa', image: house },
  { id: 'el-bochito', number: '14', label: 'El Bochito', image: car },
  { id: 'la-guitarra', number: '15', label: 'La Guitarra', image: guitar },
  { id: 'el-futbolista', number: '16', label: 'El Futbolista', image: soccerBall },
  { id: 'la-camara', number: '17', label: 'La Cámara', image: camera },
  { id: 'el-taco', number: '18', label: 'El Taco', image: tacos },
];
