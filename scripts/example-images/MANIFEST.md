# Source Photos for Homepage Example Illustrations

These are the source photos that will be fed through the Loteria card AI generation pipeline to produce the example illustrations shown on the homepage marquee.

Photos are sourced from Unsplash ([Unsplash License](https://unsplash.com/license)) and Pexels ([Pexels License](https://www.pexels.com/license/)). Both are free for commercial and non-commercial use, no attribution required (credited below as good practice).

## Photos

| #   | Filename                  | Subject                                                         | Photographer                   | Source                                                                                        |
| --- | ------------------------- | --------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | `01-wedding-couple.jpg`   | Bride smiling, groom kissing temple, soft outdoor bokeh         | Melike B (Pexels)              | https://www.pexels.com/photo/10074941/                                                        |
| 2   | `02-wedding-bouquet.jpg`  | Pink and cream bridal bouquet                                   | Annie Spratt                   | https://unsplash.com/photos/01Wa3tPoQQ8                                                       |
| 3   | `03-wedding-rings.jpg`    | Two gold wedding bands in a cream velvet ring box               | C. ISO (Pexels)                | https://www.pexels.com/photo/15950900/                                                        |
| 4   | `04-quinceanera.jpg`      | Young Latina in lavender quinceañera ballgown with tiara        | Juliano Astc (Pexels)          | https://www.pexels.com/photo/portrait-of-a-quinceanera-posing-at-her-birthday-party-17931321/ |
| 5   | `05-birthday-candles.jpg` | Boy in party hat holding fruit-topped cake with lit candles     | Antoni Shkraba Studio (Pexels) | https://www.pexels.com/photo/6148512/                                                         |
| 6   | `06-christmas-tree.jpg`   | Decorated Christmas tree with red and gold ornaments and star   | Lisa (Pexels)                  | https://www.pexels.com/photo/3325719/                                                         |
| 7   | `07-family-portrait.jpg`  | Mom + dad + baby studio portrait, plain dark gray backdrop      | Phạm Tuấn Hải (Pexels)         | https://www.pexels.com/photo/16555927/                                                        |
| 8   | `08-baby.jpg`             | Smiling baby close-up                                           | Wesley Tingey                  | https://unsplash.com/photos/beF1iDFiZkA                                                       |
| 9   | `09-grandpa.jpg`          | Older man in jacket and glasses                                 | Pietro Schellino               | https://unsplash.com/photos/MeQ6cKkozpY                                                       |
| 10  | `10-grandma.jpg`          | Elderly woman smiling broadly                                   | Chanika Dulnitha               | https://unsplash.com/photos/_1yxW6acZng                                                       |
| 11  | `11-dog.jpg`              | Golden retriever puppy portrait                                 | Victor G                       | https://unsplash.com/photos/x5oPmHmY3kQ                                                       |
| 12  | `12-cat.jpg`              | Gray tabby cat sitting against teal wall                        | Magda Ehlers (Pexels)          | https://www.pexels.com/photo/3822875/                                                         |
| 13  | `13-house.jpg`            | Yellow Americana bungalow with brown shutters, front-on         | Arshad Khan (Pexels)           | https://www.pexels.com/photo/34030968/                                                        |
| 14  | `14-car.jpg`              | Red classic VW Beetle, full 3/4 view                            | Efrem Efre (Pexels)            | https://www.pexels.com/photo/32790643/                                                        |
| 15  | `15-guitar.jpg`           | Whole acoustic guitar on stand against plain wall               | Fernando FITDG (Pexels)        | https://www.pexels.com/photo/guitar-on-white-background-15486142/                             |
| 16  | `16-soccer-ball.jpg`      | Young boy juggling a soccer ball with his foot in a sunny field | Kampus Production (Pexels)     | https://www.pexels.com/photo/8914022/                                                         |
| 17  | `17-camera.jpg`           | Vintage Polaroid Pronto 600 camera, plain white background      | Yoann Siloine                  | https://unsplash.com/photos/beYOfeTV5Zo                                                       |
| 18  | `18-tacos.jpg`            | Three street tacos on wooden plate                              | Frankie Lopez                  | https://unsplash.com/photos/_j4S4V2C8ew                                                       |

## Default-card source photos

These feed `scripts/example-images/generate-default-cards.ts` to produce the
classic Lotería webps in `public/default-cards/`. Sources are user-supplied
scans of traditional Lotería card art (with the exception of `la-rosa.jpg`,
the original seed photo). The script pipes each through `gpt-image-1.5` with
the production `ILLUSTRATION_PROMPT`, which restyles them into the app's
illustrated look while preserving subject and composition.

| Default card   | Filename             | Subject                                                    |
| -------------- | -------------------- | ---------------------------------------------------------- |
| El Gallo       | `el-gallo.jpg`       | Rooster, vintage Lotería style                             |
| El Diablito    | `el-diablito.jpg`    | Red horned devil with tail holding a trident               |
| La Dama        | `la-dama.jpg`        | Woman in green skirt-suit and pink beret holding flowers   |
| El Catrín      | `el-catrin.jpg`      | Dapper gentleman in tuxedo holding cigarette and kerchief  |
| El Paraguas    | `el-paraguas.jpg`    | Open blue umbrella in the rain                             |
| La Sirena      | `la-sirena.jpg`      | Mermaid emerging from the sea                              |
| La Escalera    | `la-escalera.jpg`    | Yellow ladder leaning against a wall                       |
| La Botella     | `la-botella.jpg`     | Glass soda bottle filled with red liquid                   |
| El Barril      | `el-barril.jpg`      | Wooden barrel painted in Mexican flag colors               |
| El Árbol       | `el-arbol.jpg`       | Lone leafy tree on a hillside                              |
| El Melón       | `el-melon.jpg`       | Sliced cantaloupe melon                                    |
| El Valiente    | `el-valiente.jpg`    | Man in striped shirt holding a kerchief                    |
| El Gorrito     | `el-gorrito.jpg`     | Ornate red embroidered baby bonnet                         |
| La Muerte      | `la-muerte.jpg`      | Yellow skeleton holding a scythe                           |
| La Pera        | `la-pera.jpg`        | Green pear with a leafy stem                               |
| La Bandera     | `la-bandera.jpg`     | Mexican flag draped on staff                               |
| El Bandolón    | `el-bandolon.jpg`    | Teardrop-body mandolin on blue background                  |
| El Violoncello | `el-violoncello.jpg` | Yellow cello on white background                           |
| La Garza       | `la-garza.jpg`       | Great blue heron standing on a log by water                |
| El Pájaro      | `el-pajaro.jpg`      | Red and yellow bird perched on a branch                    |
| La Mano        | `la-mano.jpg`        | Open palm hand                                             |
| La Bota        | `la-bota.jpg`        | Brown leather cowboy boot                                  |
| La Luna        | `la-luna.jpg`        | Crescent moon with face                                    |
| El Cotorro     | `el-cotorro.jpg`     | Green parrot perched on a branch                           |
| El Borracho    | `el-borracho.jpg`    | Man stumbling drunk with a bottle in hand                  |
| El Corazón     | `el-corazon.jpg`     | Anatomical red heart pierced by an arrow                   |
| La Sandía      | `la-sandia.jpg`      | Sliced watermelon on yellow background                     |
| El Tambor      | `el-tambor.jpg`      | Yellow drum with drumsticks                                |
| El Camarón     | `el-camaron.jpg`     | Orange shrimp                                              |
| Las Jaras      | `las-jaras.jpg`      | Crossed arrows tied with a blue ribbon                     |
| El Músico      | `el-musico.jpg`      | Man in a hat holding a guitar and sheet music              |
| La Araña       | `la-arana.jpg`       | Red spider on a web                                        |
| El Soldado     | `el-soldado.jpg`     | Soldier in green uniform holding a rifle                   |
| La Estrella    | `la-estrella.jpg`    | Five-pointed white star                                    |
| El Cazo        | `el-cazo.jpg`        | Yellow metal basin with two handles                        |
| El Mundo       | `el-mundo.jpg`       | Strongman holding up the globe                             |
| El Nopal       | `el-nopal.jpg`       | Prickly pear cactus with red fruit                         |
| El Alacrán     | `el-alacran.jpg`     | Red and black scorpion                                     |
| La Rosa        | `la-rosa.jpg`        | Pink rose bud with green leaf, white background (original) |
| La Calavera    | `la-calavera.jpg`    | Yellow sugar skull with crossbones                         |
| La Campana     | `la-campana.jpg`     | Hanging brass bell                                         |
| El Cantarito   | `el-cantarito.jpg`   | Red clay water pitcher                                     |
| El Venado      | `el-venado.jpg`      | Stag with antlers in a field                               |
| El Sol         | `el-sol.jpg`         | Red-faced sun                                              |
| La Corona      | `la-corona.jpg`      | Gold king's crown with red gems and cross                  |
| La Chalupa     | `la-chalupa.jpg`     | Woman paddling a flower-filled canoe                       |
| El Pino        | `el-pino.jpg`        | Tall green pine tree                                       |
| El Pescado     | `el-pescado.jpg`     | Pink fish jumping over water                               |
| La Palma       | `la-palma.jpg`       | Palm tree on a beach                                       |
| La Maceta      | `la-maceta.jpg`      | Flowerpot with red roses                                   |
| El Arpa        | `el-arpa.jpg`        | Golden harp                                                |
| La Rana        | `la-rana.jpg`        | Green frog on a lily pad                                   |

## Reviewer notes

All 18 photos audited against Loteria-style requirements: single hero subject, simple background, no visible text/branding, real photo, free for commercial use.

Minor notes (not blockers):

- **#10 grandma**: B&W photo. The AI restyle invents the Loteria color palette regardless, so this is fine.
- **#16 soccer-ball**: subject is a kid juggling the ball with his foot rather than the ball alone. The label `La Pelota` still applies because the ball remains the iconic element, and the kid+ball framing reads more dynamically as Loteria art.
- **#18 tacos**: three tacos + lime wedges (a "plate" rather than single object). Iconic for "tacos" subject and the Loteria pipeline handles complex food scenes per its prompt.

## Generating illustrations

```bash
pnpm secrets:pull        # one-time, pulls OPENAI_API_KEY into .env.local
pnpm generate:examples   # runs scripts/example-images/generate-illustrations.ts
```

Outputs go to `scripts/example-images/illustrations/` (one PNG per source photo) plus a `manifest.json` that records the AI-generated Spanish label and timing for each.

The script is idempotent — re-runs skip any illustration that already exists. To regenerate one, delete its PNG. To redo everything, delete the whole `illustrations/` directory.

The script imports `ILLUSTRATION_PROMPT` from `lib/illustration-prompt.ts`, the same module the production Inngest pipeline uses, so the demo output stays in sync with the real product.
