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
 * Generates 4 different boards, each with 16 randomly selected cards
 */
export function generateBoards(cards: LotteriaCard[]): LotteriaCard[][] {
  const processedCards = cards.filter((c) => !c.isProcessing && !c.error);

  if (processedCards.length < 16) {
    throw new Error('Need at least 16 processed cards to generate boards');
  }

  const boards: LotteriaCard[][] = [];

  for (let i = 0; i < 4; i++) {
    // Shuffle cards for variety between boards
    const shuffled = shuffleArray(processedCards);
    // Select first 16 cards (no duplicates within board)
    boards.push(shuffled.slice(0, 16));
  }

  return boards;
}

/**
 * Loads an image from a data URL and returns a Promise<HTMLImageElement>
 */
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

      // Draw card background/border
      ctx.strokeStyle = cardBorderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardWidth, cardHeight);

      // Draw card illustration (portrait orientation, centered with padding)
      const imagePadding = 15;
      const badgeSpace = 50; // Space for the number badge at top
      const labelSpace = 50; // Space for the label at bottom

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

      ctx.save();
      ctx.beginPath();
      ctx.rect(imageX, imageY, imageWidth, imageHeight);
      ctx.clip();
      ctx.drawImage(img, imageX, imageY, imageWidth, imageHeight);
      ctx.restore();

      // Draw number badge (top-left corner)
      const badgeSize = 50;
      const badgeX = x + 10;
      const badgeY = y + 10;

      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'normal 24px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.number.toString(), badgeX + badgeSize / 2, badgeY + badgeSize / 2);

      // Draw label text (bottom of card)
      ctx.fillStyle = labelColor;

      // Use a regular to semi-bold uppercase sans-serif font matching Loteria card style
      // Arial or Helvetica with normal weight for a cleaner, less thick look
      const labelText = card.label.toUpperCase();
      const baseFontSize = 28;
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
