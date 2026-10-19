import type { ReactNode, SVGProps } from 'react';

function Base({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      {children}
    </svg>
  );
}
type P = SVGProps<SVGSVGElement>;

export const HomeIcon = (p: P) => (
  <Base {...p}><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></Base>
);
export const TrainIcon = (p: P) => (
  <Base {...p}><path d="M12 3l2.2 5.2L20 9l-4.3 3.7L17 18l-5-3-5 3 1.3-5.3L4 9l5.8-.8z" /></Base>
);
export const PawIcon = (p: P) => (
  <Base {...p}>
    <circle cx="6.5" cy="10" r="1.7" /><circle cx="10" cy="6.5" r="1.7" /><circle cx="14.5" cy="6.5" r="1.7" /><circle cx="18" cy="10" r="1.7" />
    <path d="M12 11c-3 0-5.5 3-5.5 5.2 0 1.7 1.4 2.6 3 2.3 1-.2 1.6-.5 2.5-.5s1.5.3 2.5.5c1.6.3 3-.6 3-2.3C17.5 14 15 11 12 11z" />
  </Base>
);
export const BookIcon = (p: P) => (
  <Base {...p}><path d="M5 5.5C5 4.7 5.7 4 6.5 4H19v15H6.5C5.7 19 5 19.7 5 20.5z" /><path d="M5 5.5v15" /><path d="M9 8h6M9 12h6" /></Base>
);
export const GearIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </Base>
);
export const SpeakerIcon = (p: P) => (
  <Base {...p}><path d="M4 10v4h3.5L12 18V6L7.5 10z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></Base>
);
export const CameraIcon = (p: P) => (
  <Base {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.4" /></Base>
);
export const CloseIcon = (p: P) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
);
export const BackIcon = (p: P) => (
  <Base {...p}><path d="M15 5l-7 7 7 7" /></Base>
);
export const PlusIcon = (p: P) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
);
export const TrashIcon = (p: P) => (
  <Base {...p}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></Base>
);
export const CheckIcon = (p: P) => (
  <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>
);
export const MoonIcon = (p: P) => (
  <Base {...p}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></Base>
);
export const BallIcon = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="8" /><path d="M4.5 10c4 1 8 1 15 -1M6 17c4-3 8-3 12-1" /></Base>
);
export const BerryIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 7c-4 0-6.5 3-6.5 6.2C5.5 17 8.5 20 12 20s6.5-3 6.5-6.8C18.5 10 16 7 12 7z" fill="currentColor" fillOpacity="0.18" />
    <path d="M12 7c0-1.5.8-2.8 2.5-3.5M12 7c-.6-1.4-2-2.2-3.5-2" />
  </Base>
);
export const StarIcon = (p: P) => (
  <Base {...p}><path d="M12 3.5l2.4 5.1 5.6.7-4.1 3.9 1 5.5-4.9-2.7-4.9 2.7 1-5.5L4 9.3l5.6-.7z" fill="currentColor" fillOpacity="0.22" /></Base>
);
export const EggIcon = (p: P) => (
  <Base {...p}><path d="M12 3c3.6 0 6 5 6 9.2 0 3.6-2.7 6.3-6 6.3s-6-2.7-6-6.3C6 8 8.4 3 12 3z" fill="currentColor" fillOpacity="0.18" /></Base>
);
export const SwapIcon = (p: P) => (
  <Base {...p}><path d="M7 4 3.5 7.5 7 11M3.5 7.5H15M17 13l3.5 3.5L17 20M20.5 16.5H9" /></Base>
);
export const DownloadIcon = (p: P) => (
  <Base {...p}><path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19h14" /></Base>
);
export const UploadIcon = (p: P) => (
  <Base {...p}><path d="M12 16V5M7.5 9 12 4.5 16.5 9M5 19h14" /></Base>
);
export const HeartIcon = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d="M12 20.5C5 15.5 3 12.5 3 9.3 3 6.7 5 5 7.2 5c1.9 0 3.5 1 4.8 3 1.3-2 2.9-3 4.8-3C19 5 21 6.7 21 9.3c0 3.2-2 6.2-9 11.2z" fill="#FF9AA2" stroke="#fff" strokeWidth="1.2" /></svg>
);
export const SparkIcon = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d="M12 1.5l2.4 7.1 7.1 2.4-7.1 2.4L12 20.5l-2.4-7.1-7.1-2.4 7.1-2.4z" fill="#FFE08A" stroke="#fff" strokeWidth="1" /></svg>
);
