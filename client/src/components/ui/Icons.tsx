import type { ReactNode } from 'react';

// All the small icons of the app, as React components.
// They use currentColor, so they take the text color of the button around them.

interface IconProps {
  size?: number;
}

interface BaseIconProps extends IconProps {
  children: ReactNode;
}

function BaseIcon({ size = 20, children }: BaseIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SearchIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </BaseIcon>
  );
}

export function BackIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M15 6l-6 6 6 6" />
    </BaseIcon>
  );
}

export function ChevronIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M9 6l6 6-6 6" />
    </BaseIcon>
  );
}

export function CloseIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </BaseIcon>
  );
}

export function ShareIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4" />
      <path d="M15.4 6.5l-6.8 4" />
    </BaseIcon>
  );
}

export function QrIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M21 14v.01" />
      <path d="M14 21h.01" />
      <path d="M17 21h4v-3" />
    </BaseIcon>
  );
}

export function ChatIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </BaseIcon>
  );
}

export function SendIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
    </BaseIcon>
  );
}

export function SirenIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M12 4a6 6 0 0 0-6 6v6h12v-6a6 6 0 0 0-6-6z" />
      <path d="M4 20h16" />
      <path d="M12 8v4" />
    </BaseIcon>
  );
}

export function ElevatorIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 9l3-3 3 3" />
      <path d="M9 15l3 3 3-3" />
    </BaseIcon>
  );
}

export function FlagIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </BaseIcon>
  );
}

export function ShieldIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </BaseIcon>
  );
}

export function ClockIcon({ size = 16 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </BaseIcon>
  );
}

export function LinkIcon({ size = 16 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </BaseIcon>
  );
}

export function CheckIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M5 12l5 5 9-10" />
    </BaseIcon>
  );
}

// "Find me" - a target, like in map apps
export function LocateIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </BaseIcon>
  );
}

export function DirectionsIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" />
      <path d="M9 14v-2.5a1.5 1.5 0 0 1 1.5-1.5H15" />
      <path d="M13 8l2 2-2 2" />
    </BaseIcon>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h10" />
    </BaseIcon>
  );
}

// The same drawings as the markers on the map
export function BuildingTypeIcon({ type, size = 18 }: IconProps & { type: string }) {
  if (type === 'hospital') {
    return (
      <BaseIcon size={size}>
        <path d="M12 5v14M5 12h14" />
      </BaseIcon>
    );
  }
  if (type === 'campus') {
    return (
      <BaseIcon size={size}>
        <path d="M3 9l9-5 9 5-9 5-9-5z" />
        <path d="M7 11v5c3 2 7 2 10 0v-5" />
      </BaseIcon>
    );
  }
  return (
    <BaseIcon size={size}>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-6h6v6" />
    </BaseIcon>
  );
}

export function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#12161C" />
      <path d="M10 22c0-6 12-3 12-10" fill="none" stroke="#FFC93C" strokeWidth="3" strokeLinecap="round" />
      <circle cx="10" cy="22" r="3" fill="#FFC93C" />
      <circle cx="22" cy="11" r="3" fill="#FFFFFF" />
    </svg>
  );
}
