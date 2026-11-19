import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImageProps {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
}

export function QrCodeImage({
  value,
  size = 180,
  className = '',
  alt = 'Employee QR Pass',
}: QrCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation failed:', err);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 border border-slate-200 rounded-lg animate-pulse ${className}`}
        aria-label="Generating QR code"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`block rounded-md bg-white ${className}`}
    />
  );
}
