# Image eval test photos

Real photographs (not illustrations): turning photos into Lotería cards is
what the app does. Each one stresses something different. All are from
[Pexels](https://www.pexels.com) under the
[Pexels License](https://www.pexels.com/license/) (free for commercial use, no
attribution required). Downloaded at 1600px wide.

| File                        | Tests                                                  | Source                                                                                                     | Photographer        |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| `01-portrait.jpg`           | Likeness of one face, soft window light                | [31768384](https://www.pexels.com/photo/portrait-of-a-man-in-soft-natural-light-31768384/)                 | Allan Carvalho      |
| `02-family-gathering.jpg`   | 13 people, varied poses, small faces                   | [33239448](https://www.pexels.com/photo/joyful-family-gathering-on-cape-town-beach-33239448/)              | Keanu Henry         |
| `03-dog-closeup.jpg`        | Tight crop, fur texture, subject cut off at frame edge | [406014](https://www.pexels.com/photo/closeup-photo-of-brown-and-black-dog-face-406014/)                   | Lum3n               |
| `04-hockey-action.jpg`      | Motion, several players, crowd, ad text on the boards  | [38553562](https://www.pexels.com/photo/exciting-ice-hockey-match-in-buenos-aires-arena-38553562/)         | Gera Cejas          |
| `05-thanksgiving-table.jpg` | Many small objects (dishes, glasses, decor)            | [5876741](https://www.pexels.com/photo/wooden-table-served-with-tasty-dishes-on-thanksgiving-day-5876741/) | Monstera Production |

Re-download any of them with:

```bash
curl -sSL -A "Mozilla/5.0" -o scripts/image-eval/photos/<file> \
  'https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1600'
```
