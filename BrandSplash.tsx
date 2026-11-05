import { useEffect, useRef } from 'react';

// Self-contained vector rendition of the supplied black-and-white brand mark.
export function BrandSplash({ onFinish, reduced = false }: { onFinish: () => void; reduced?: boolean }) {
  const finish = useRef(onFinish);
  finish.current = onFinish;
  useEffect(() => {
    const timer = window.setTimeout(() => finish.current(), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className={`alpha-splash fixed inset-0 z-50 flex items-center justify-center bg-black ${reduced ? 'alpha-reduced' : ''}`} role="img" aria-label="Alpha Gaming logo">
    <svg viewBox="0 0 330 235" className="alpha-logo w-[min(78vw,55vh,470px)] h-auto" aria-hidden="true" focusable="false">
      <g className="alpha-monogram" fill="#fff">
        <path className="alpha-letter alpha-letter-a" d="M40 148 111 25l16 28-51 95H40Zm86-86 50 86h-31l-36-63 17-23Z" />
        <path className="alpha-letter alpha-letter-bar" d="M77 116h61l13 23H64l13-23Z" />
        <path className="alpha-letter alpha-letter-g" d="M218 28c34 0 59 18 68 47h-30c-6-13-19-20-38-20-23 0-39 16-39 38 0 23 16 39 39 39 17 0 30-8 36-20h-29V89h63v59h-27v-13c-11 11-25 17-45 17-39 0-68-25-68-59 0-37 30-65 70-65Z" />
      </g>
      <text className="alpha-wordmark" x="165" y="198" textAnchor="middle" fill="#fff" fontFamily="'Arial Narrow', Impact, 'Liberation Sans Narrow', Arial, sans-serif" fontSize="30" fontWeight="900" letterSpacing="0.4" textLength="232" lengthAdjust="spacingAndGlyphs">ALPHA GAMING</text>
    </svg>
  </div>;
}