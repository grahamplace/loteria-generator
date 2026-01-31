import { LotteriaCard } from '@/hooks/use-cards';
import JSZip from 'jszip';

/**
 * Styling options for board generation
 */
export interface BoardStyleOptions {
  backgroundColor?: string;
  cardBorderColor?: string;
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
 * Generates 4 different boards, each with 16 randomly selected cards.
 * Ensures no two boards have the same arrangement to prevent multiple winners.
 */
export function generateBoards(cards: LotteriaCard[]): LotteriaCard[][] {
  const processedCards = cards.filter((c) => !c.isProcessing && !c.error);

  if (processedCards.length < 16) {
    throw new Error('Need at least 16 processed cards to generate boards');
  }

  const boards: LotteriaCard[][] = [];
  const usedSignatures = new Set<string>();
  const maxAttempts = 100; // Prevent infinite loops

  for (let i = 0; i < 4; i++) {
    let attempts = 0;
    let board: LotteriaCard[];
    let signature: string;

    // Keep generating until we get a unique arrangement
    do {
      const shuffled = shuffleArray(processedCards);
      board = shuffled.slice(0, 16);
      signature = getBoardSignature(board);
      attempts++;

      if (attempts >= maxAttempts) {
        // If we can't find a unique arrangement after many attempts,
        // just use this one (extremely unlikely with enough cards)
        break;
      }
    } while (usedSignatures.has(signature));

    usedSignatures.add(signature);
    boards.push(board);
  }

  return boards;
}

/**
 * Loads an image from a data URL and returns a Promise<HTMLImageElement>
 */
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
  const segments = 12; // segments per side
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
 * Renders a single board as a PNG image
 * Board dimensions: 8.5" × 11" (US Letter) at 300 DPI = 2550 × 3300 pixels
 */
export async function renderBoardAsPNG(
  board: LotteriaCard[],
  boardNumber: number,
  styleOptions: BoardStyleOptions = {}
): Promise<Blob> {
  const {
    backgroundColor = '#ffffff',
    cardBorderColor = '#e5e7eb',
    badgeColor = '#ff6b35',
    labelColor = '#1f2937',
  } = styleOptions;
  // Standard US Letter size at 300 DPI for print quality
  const width = 2550;
  const height = 3300;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Grid layout: 4 rows × 4 columns with portrait-oriented cards (2:3 aspect ratio)
  const rows = 4;
  const cols = 4;
  const padding = 60; // Padding around the entire board
  const cardSpacing = 20; // Spacing between cards

  // Calculate card dimensions to fit portrait cards (2:3 aspect ratio) in the grid
  // Available space for cards
  const availableWidth = width - padding * 2 - cardSpacing * (cols - 1);
  const availableHeight = height - padding * 2 - cardSpacing * (rows - 1);

  // Calculate card size based on portrait aspect ratio (2:3)
  const cardAspectRatio = 2 / 3;
  const maxCardWidth = availableWidth / cols;
  const maxCardHeight = availableHeight / rows;

  // Determine which dimension is the constraint
  let cardWidth: number;
  let cardHeight: number;
  if (maxCardWidth / maxCardHeight < cardAspectRatio) {
    // Width is the constraint
    cardWidth = maxCardWidth;
    cardHeight = cardWidth / cardAspectRatio;
  } else {
    // Height is the constraint
    cardHeight = maxCardHeight;
    cardWidth = cardHeight * cardAspectRatio;
  }

  // Center the grid on the page
  const gridWidth = cardWidth * cols + cardSpacing * (cols - 1);
  const gridHeight = cardHeight * rows + cardSpacing * (rows - 1);
  const offsetX = (width - gridWidth) / 2;
  const offsetY = (height - gridHeight) / 2;

  // Load handwritten font for number badges
  await loadGoogleFont(
    'Caveat',
    'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpYQ.woff2'
  );

  // Load all card images first
  const cardImages = await Promise.all(board.map((card) => loadImage(card.illustration)));

  // Draw each card in the grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cardIndex = row * cols + col;
      const card = board[cardIndex];
      const img = cardImages[cardIndex];

      const x = offsetX + col * (cardWidth + cardSpacing);
      const y = offsetY + row * (cardHeight + cardSpacing);

      // Draw hand-drawn card border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      drawHandDrawnRect(ctx, x, y, cardWidth, cardHeight, 2);

      // Draw card illustration (portrait orientation, centered with padding)
      const imagePadding = 5;
      const badgeSpace = 30; // Space for the number badge at top
      const labelSpace = 40; // Space for the label at bottom

      // Available space for the image (portrait aspect ratio 2:3)
      const availableImageWidth = cardWidth - imagePadding * 2;
      const availableImageHeight = cardHeight - imagePadding * 2 - badgeSpace - labelSpace;

      // Calculate image dimensions maintaining 2:3 aspect ratio
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

      // Build alpha mask on a separate canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imageWidth;
      maskCanvas.height = imageHeight;
      const maskCtx = maskCanvas.getContext('2d')!;

      // Start fully opaque
      maskCtx.fillStyle = '#fff';
      maskCtx.fillRect(0, 0, imageWidth, imageHeight);

      // Multiply each edge fade using 'destination-in' wouldn't work per-edge,
      // so instead use 'destination-out' with inverted gradients (opaque at edge, transparent inside)
      maskCtx.globalCompositeOperation = 'destination-out';

      // Left edge
      const gradL = maskCtx.createLinearGradient(0, 0, feather, 0);
      gradL.addColorStop(0, 'rgba(0,0,0,1)');
      gradL.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = gradL;
      maskCtx.fillRect(0, 0, feather, imageHeight);

      // Right edge
      const gradR = maskCtx.createLinearGradient(imageWidth, 0, imageWidth - feather, 0);
      gradR.addColorStop(0, 'rgba(0,0,0,1)');
      gradR.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = gradR;
      maskCtx.fillRect(imageWidth - feather, 0, feather, imageHeight);

      // Top edge
      const gradT = maskCtx.createLinearGradient(0, 0, 0, feather);
      gradT.addColorStop(0, 'rgba(0,0,0,1)');
      gradT.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = gradT;
      maskCtx.fillRect(0, 0, imageWidth, feather);

      // Bottom edge
      const gradB = maskCtx.createLinearGradient(0, imageHeight, 0, imageHeight - feather);
      gradB.addColorStop(0, 'rgba(0,0,0,1)');
      gradB.addColorStop(1, 'rgba(0,0,0,0)');
      maskCtx.fillStyle = gradB;
      maskCtx.fillRect(0, imageHeight - feather, imageWidth, feather);

      // Now draw image masked by the alpha mask
      const offscreen = document.createElement('canvas');
      offscreen.width = imageWidth;
      offscreen.height = imageHeight;
      const offCtx = offscreen.getContext('2d')!;
      offCtx.drawImage(img, 0, 0, imageWidth, imageHeight);
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

      // Use a regular to semi-bold uppercase sans-serif font matching Loteria card style
      // Arial or Helvetica with normal weight for a cleaner, less thick look
      const labelText = card.label.toUpperCase();
      const baseFontSize = 32;
      ctx.font = `normal ${baseFontSize}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      const labelY = y + cardHeight - 15;
      const maxLabelWidth = cardWidth - 20;

      // Handle long labels by reducing font size
      let fontSize = baseFontSize;
      let metrics = ctx.measureText(labelText);

      // Try to fit text by reducing font size if needed
      while (metrics.width > maxLabelWidth && fontSize > 16) {
        fontSize -= 1;
        ctx.font = `normal ${fontSize}px Arial, Helvetica, sans-serif`;
        metrics = ctx.measureText(labelText);
      }

      // Draw the label text
      ctx.fillText(labelText, x + cardWidth / 2, labelY);
    }
  }

  // Convert canvas to PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Generates all boards and creates a zip file
 */
export async function generateBoardsZip(
  cards: LotteriaCard[],
  styleOptions: BoardStyleOptions = {}
): Promise<Blob> {
  const boards = generateBoards(cards);
  const zip = new JSZip();

  // Generate PNG for each board
  for (let i = 0; i < boards.length; i++) {
    const boardPNG = await renderBoardAsPNG(boards[i], i + 1, styleOptions);
    zip.file(`board-${i + 1}.png`, boardPNG);
  }

  // Generate zip file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}
