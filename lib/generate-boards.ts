import { jsPDF } from 'jspdf';

export interface LotteriaCard {
  id: string;
  label: string;
  illustration: string;
  number: number;
  isProcessing?: boolean;
  error?: string;
}

/**
 * Styling options for board generation
 */
export interface BoardStyleOptions {
  backgroundColor?: string;
  badgeColor?: string;
  labelColor?: string;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Creates a unique signature for a board arrangement based on card IDs in order
 */
function getBoardSignature(board: LotteriaCard[]): string {
  return board.map((card) => card.id).join(',');
}

/**
 * Generates 50 different boards, each with 16 randomly selected cards.
 * Ensures no two boards have the same arrangement to prevent multiple winners.
 */
export function generateBoards(cards: LotteriaCard[], count: number = 50): LotteriaCard[][] {
  const processedCards = cards.filter((c) => !c.isProcessing && !c.error);

  if (processedCards.length < 16) {
    throw new Error('Need at least 16 processed cards to generate boards');
  }

  const boards: LotteriaCard[][] = [];
  const usedSignatures = new Set<string>();
  const maxAttempts = 100;

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let board: LotteriaCard[];
    let signature: string;

    do {
      const shuffled = shuffleArray(processedCards);
      board = shuffled.slice(0, 16);
      signature = getBoardSignature(board);
      attempts++;

      if (attempts >= maxAttempts) {
        break;
      }
    } while (usedSignatures.has(signature));

    usedSignatures.add(signature);
    boards.push(board);
  }

  return boards;
}

/**
 * Loads a Google Font for canvas rendering via FontFace API
 */
async function loadGoogleFont(family: string, url: string): Promise<void> {
  const font = new FontFace(family, `url(${url})`);
  const loaded = await font.load();
  document.fonts.add(loaded);
}

/**
 * Draws a wobbly/hand-drawn rectangle on the canvas
 */
function drawHandDrawnRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  jitter: number = 3
) {
  const segments = 12;
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];

  ctx.beginPath();
  for (let side = 0; side < 4; side++) {
    const [sx, sy] = corners[side];
    const [ex, ey] = corners[(side + 1) % 4];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px =
        sx + (ex - sx) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * jitter * 2 : 0);
      const py =
        sy + (ey - sy) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * jitter * 2 : 0);
      if (side === 0 && i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
  }
  ctx.closePath();
  ctx.stroke();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draws a single card on the canvas at the specified position and size.
 * Includes hand-drawn border, feathered image, number badge, and label.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  card: LotteriaCard,
  img: HTMLImageElement,
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
  styleOptions: { badgeColor: string; labelColor: string }
) {
  const { badgeColor, labelColor } = styleOptions;

  // Draw hand-drawn card border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  drawHandDrawnRect(ctx, x, y, cardWidth, cardHeight, 2);

  // Draw card illustration (portrait orientation, centered with padding)
  const imagePadding = 5;
  const badgeSpace = 30;
  const labelSpace = 40;

  const availableImageWidth = cardWidth - imagePadding * 2;
  const availableImageHeight = cardHeight - imagePadding * 2 - badgeSpace - labelSpace;

  const imageAspectRatio = 2 / 3;
  let imageWidth: number;
  let imageHeight: number;

  if (availableImageWidth / availableImageHeight < imageAspectRatio) {
    imageWidth = availableImageWidth;
    imageHeight = imageWidth / imageAspectRatio;
  } else {
    imageHeight = availableImageHeight;
    imageWidth = imageHeight * imageAspectRatio;
  }

  const imageX = x + (cardWidth - imageWidth) / 2;
  const imageY = y + badgeSpace + (availableImageHeight - imageHeight) / 2 + imagePadding;

  // Draw image with feathered edges using an offscreen canvas + alpha mask
  const feather = 35;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = imageWidth;
  maskCanvas.height = imageHeight;
  const maskCtx = maskCanvas.getContext('2d')!;

  maskCtx.fillStyle = '#fff';
  maskCtx.fillRect(0, 0, imageWidth, imageHeight);

  maskCtx.globalCompositeOperation = 'destination-out';

  const gradL = maskCtx.createLinearGradient(0, 0, feather, 0);
  gradL.addColorStop(0, 'rgba(0,0,0,1)');
  gradL.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = gradL;
  maskCtx.fillRect(0, 0, feather, imageHeight);

  const gradR = maskCtx.createLinearGradient(imageWidth, 0, imageWidth - feather, 0);
  gradR.addColorStop(0, 'rgba(0,0,0,1)');
  gradR.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = gradR;
  maskCtx.fillRect(imageWidth - feather, 0, feather, imageHeight);

  const gradT = maskCtx.createLinearGradient(0, 0, 0, feather);
  gradT.addColorStop(0, 'rgba(0,0,0,1)');
  gradT.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = gradT;
  maskCtx.fillRect(0, 0, imageWidth, feather);

  const gradB = maskCtx.createLinearGradient(0, imageHeight, 0, imageHeight - feather);
  gradB.addColorStop(0, 'rgba(0,0,0,1)');
  gradB.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = gradB;
  maskCtx.fillRect(0, imageHeight - feather, imageWidth, feather);

  const offscreen = document.createElement('canvas');
  offscreen.width = imageWidth;
  offscreen.height = imageHeight;
  const offCtx = offscreen.getContext('2d')!;

  // Draw image with "object-fit: cover" behavior — crop to fill, centered
  const targetAspect = imageWidth / imageHeight;
  const srcAspect = img.naturalWidth / img.naturalHeight;
  let sx: number, sy: number, sw: number, sh: number;
  if (srcAspect > targetAspect) {
    // Source is wider — crop sides
    sh = img.naturalHeight;
    sw = sh * targetAspect;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    // Source is taller — crop top/bottom
    sw = img.naturalWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, imageWidth, imageHeight);

  offCtx.globalCompositeOperation = 'destination-in';
  offCtx.drawImage(maskCanvas, 0, 0);

  ctx.drawImage(offscreen, imageX, imageY);

  // Draw number badge (top-left corner)
  const badgeSize = 70;
  const badgeX = x + 10;
  const badgeY = y + 10;

  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Caveat, cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.number.toString(), badgeX + badgeSize / 2, badgeY + badgeSize / 2);

  // Draw label text (bottom of card)
  ctx.fillStyle = labelColor;

  const labelText = card.label.toUpperCase();
  const baseFontSize = 32;
  ctx.font = `normal ${baseFontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const labelY2 = y + cardHeight - 15;
  const maxLabelWidth = cardWidth - 20;

  let fontSize = baseFontSize;
  let metrics = ctx.measureText(labelText);

  while (metrics.width > maxLabelWidth && fontSize > 16) {
    fontSize -= 1;
    ctx.font = `normal ${fontSize}px Arial, Helvetica, sans-serif`;
    metrics = ctx.measureText(labelText);
  }

  ctx.fillText(labelText, x + cardWidth / 2, labelY2);
}

/**
 * Renders a single board onto a canvas.
 * Board dimensions: 8.5" × 11" (US Letter) at 300 DPI = 2550 × 3300 pixels
 */
async function renderBoardToCanvas(
  board: LotteriaCard[],
  styleOptions: BoardStyleOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    backgroundColor = '#ffffff',
    badgeColor = '#ff6b35',
    labelColor = '#1f2937',
  } = styleOptions;

  const width = 2550;
  const height = 3300;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const rows = 4;
  const cols = 4;
  const padding = 60;
  const cardSpacing = 20;

  const availableWidth = width - padding * 2 - cardSpacing * (cols - 1);
  const availableHeight = height - padding * 2 - cardSpacing * (rows - 1);

  const cardAspectRatio = 2 / 3;
  const maxCardWidth = availableWidth / cols;
  const maxCardHeight = availableHeight / rows;

  let cardWidth: number;
  let cardHeight: number;
  if (maxCardWidth / maxCardHeight < cardAspectRatio) {
    cardWidth = maxCardWidth;
    cardHeight = cardWidth / cardAspectRatio;
  } else {
    cardHeight = maxCardHeight;
    cardWidth = cardHeight * cardAspectRatio;
  }

  const gridWidth = cardWidth * cols + cardSpacing * (cols - 1);
  const gridHeight = cardHeight * rows + cardSpacing * (rows - 1);
  const offsetX = (width - gridWidth) / 2;
  const offsetY = (height - gridHeight) / 2;

  await loadGoogleFont(
    'Caveat',
    'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpYQ.woff2'
  );

  const cardImages = await Promise.all(board.map((card) => loadImage(card.illustration)));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cardIndex = row * cols + col;
      const card = board[cardIndex];
      const img = cardImages[cardIndex];

      const x = offsetX + col * (cardWidth + cardSpacing);
      const y = offsetY + row * (cardHeight + cardSpacing);

      drawCard(ctx, card, img, x, y, cardWidth, cardHeight, { badgeColor, labelColor });
    }
  }

  return canvas;
}

/**
 * Renders a deck page with cards in a 3×3 grid onto a canvas.
 * Page dimensions: 8.5" × 11" (US Letter) at 300 DPI = 2550 × 3300 pixels
 */
async function renderDeckPageToCanvas(
  cards: LotteriaCard[],
  styleOptions: BoardStyleOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    backgroundColor = '#ffffff',
    badgeColor = '#ff6b35',
    labelColor = '#1f2937',
  } = styleOptions;

  const width = 2550;
  const height = 3300;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const rows = 3;
  const cols = 3;
  const cardSpacing = 40;

  // Standard playing card size: 2.5" × 3.5" at 300 DPI
  const cardWidth = 750;
  const cardHeight = 1050;

  const headerHeight = 120;
  const gridWidth = cardWidth * cols + cardSpacing * (cols - 1);
  const gridHeight = cardHeight * rows + cardSpacing * (rows - 1);
  const offsetX = (width - gridWidth) / 2;
  const offsetY = headerHeight + (height - headerHeight - gridHeight) / 2;

  // Draw header label
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 48px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✂  Cut along lines to make individual cards', width / 2, headerHeight / 2);

  await loadGoogleFont(
    'Caveat',
    'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpYQ.woff2'
  );

  const cardImages = await Promise.all(cards.map((card) => loadImage(card.illustration)));

  for (let i = 0; i < cards.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const card = cards[i];
    const img = cardImages[i];

    const x = offsetX + col * (cardWidth + cardSpacing);
    const y = offsetY + row * (cardHeight + cardSpacing);

    drawCard(ctx, card, img, x, y, cardWidth, cardHeight, { badgeColor, labelColor });
  }

  // Draw dashed cut lines between cards
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 12]);

  // Vertical cut lines between columns
  for (let col = 1; col < cols; col++) {
    const lineX = offsetX + col * (cardWidth + cardSpacing) - cardSpacing / 2;
    ctx.beginPath();
    ctx.moveTo(lineX, offsetY - 10);
    ctx.lineTo(lineX, offsetY + gridHeight + 10);
    ctx.stroke();
  }

  // Horizontal cut lines between rows
  for (let row = 1; row < rows; row++) {
    const lineY = offsetY + row * (cardHeight + cardSpacing) - cardSpacing / 2;
    ctx.beginPath();
    ctx.moveTo(offsetX - 10, lineY);
    ctx.lineTo(offsetX + gridWidth + 10, lineY);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  return canvas;
}

/**
 * Generates a complete Loteria set (50 boards + deck pages) as a single multi-page PDF
 */
export async function generateLoteriaSetPdf(
  cards: LotteriaCard[],
  styleOptions: BoardStyleOptions = {},
  onProgress?: (message: string) => void
): Promise<Blob> {
  const boards = generateBoards(cards, 50);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  // Generate 50 board pages
  for (let i = 0; i < boards.length; i++) {
    onProgress?.(`Generating board ${i + 1} of ${boards.length}…`);
    if (i > 0) pdf.addPage('letter', 'portrait');
    const canvas = await renderBoardToCanvas(boards[i], styleOptions);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
  }

  // Generate deck pages (9 cards per page, ordered by card number)
  const processedCards = cards
    .filter((c) => !c.isProcessing && !c.error)
    .sort((a, b) => a.number - b.number);

  const cardsPerPage = 9;
  const totalPages = Math.ceil(processedCards.length / cardsPerPage);

  for (let i = 0; i < totalPages; i++) {
    onProgress?.(`Generating deck page ${i + 1} of ${totalPages}…`);
    pdf.addPage('letter', 'portrait');
    const pageCards = processedCards.slice(i * cardsPerPage, (i + 1) * cardsPerPage);
    const canvas = await renderDeckPageToCanvas(pageCards, styleOptions);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
  }

  onProgress?.('Creating PDF…');
  const pdfBlob = pdf.output('blob');
  return pdfBlob;
}
