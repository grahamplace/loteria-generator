import { ImageResponse } from 'next/og';

export const alt = 'Lotería Generator — Create custom Mexican Lotería cards from your photos';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f0e1',
        padding: 56,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          right: 24,
          bottom: 24,
          border: '6px solid #c8362e',
          borderRadius: 24,
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 36,
          right: 36,
          bottom: 36,
          border: '2px solid #e4b441',
          borderRadius: 18,
          display: 'flex',
        }}
      />
      <div
        style={{
          fontSize: 40,
          color: '#1e7572',
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 12,
          display: 'flex',
        }}
      >
        Custom Mexican Lotería
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: '#c8362e',
          lineHeight: 1,
          marginBottom: 8,
          display: 'flex',
        }}
      >
        Lotería Generator
      </div>
      <div
        style={{
          fontSize: 44,
          color: '#3d2b1f',
          fontWeight: 500,
          marginTop: 24,
          textAlign: 'center',
          maxWidth: 900,
          lineHeight: 1.2,
          display: 'flex',
        }}
      >
        Turn your photos into a custom Lotería set
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 48,
          fontSize: 28,
          color: '#3d2b1f',
        }}
      >
        <div
          style={{
            padding: '10px 22px',
            background: '#e4b441',
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Weddings
        </div>
        <div
          style={{
            padding: '10px 22px',
            background: '#e4b441',
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Quinceañeras
        </div>
        <div
          style={{
            padding: '10px 22px',
            background: '#e4b441',
            borderRadius: 999,
            fontWeight: 700,
          }}
        >
          Parties
        </div>
      </div>
    </div>,
    { ...size }
  );
}
