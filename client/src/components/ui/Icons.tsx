import type { ReactNode } from 'react';
import { getBuildingTypePaths } from './buildingTypeIcons';

// All the small icons of the app, as React components.
// They use currentColor, so they take the text color of the button around them.

interface IconProps {
  size?: number;
}

interface BaseIconProps extends IconProps {
  children: ReactNode;
  // An icon that points somewhere (back, forward, send). In a right-to-left page it is mirrored, in theme.css.
  isDirectional?: boolean;
}

function BaseIcon({ size = 20, isDirectional = false, children }: BaseIconProps) {
  return (
    <svg
      className={isDirectional ? 'icon-directional' : undefined}
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

export function HomeIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </BaseIcon>
  );
}

export function MapIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </BaseIcon>
  );
}

export function UserIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </BaseIcon>
  );
}

export function StoreIcon({ size }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M3 9l2-5h14l2 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      <path d="M3 9h18" />
      <path d="M9 22V12h6v10" />
    </BaseIcon>
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
    <BaseIcon size={size} isDirectional>
      <path d="M15 6l-6 6 6 6" />
    </BaseIcon>
  );
}

export function ChevronIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size} isDirectional>
      <path d="M9 6l6 6-6 6" />
    </BaseIcon>
  );
}

export function ChevronUpIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M18 15l-6-6-6 6" />
    </BaseIcon>
  );
}

export function ChevronDownIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M6 9l6 6 6-6" />
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
    <BaseIcon size={size} isDirectional>
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

export function PencilIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </BaseIcon>
  );
}

// "Manage buildings" - a small dashboard
export function DashboardIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </BaseIcon>
  );
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M12 5v14M5 12h14" />
    </BaseIcon>
  );
}

export function TrashIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </BaseIcon>
  );
}

export function UploadIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </BaseIcon>
  );
}

export function PrinterIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M7 9V3h10v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </BaseIcon>
  );
}

// The same drawings as the markers on the map (see buildingTypeIcons.ts).
// dangerouslySetInnerHTML is safe here: the paths are our own constants, never user text.
export function BuildingTypeIcon({ type, size = 18 }: IconProps & { type: string }) {
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
      dangerouslySetInnerHTML={{ __html: getBuildingTypePaths(type) }}
    />
  );
}

export function AccessibleIcon({ size = 20 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7.5v4.5l3.5 2" />
      <path d="M9 18a4.5 4.5 0 1 0 4.5-4.5" />
      <path d="M15.5 14h3" />
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

export function StarIcon({ size = 20, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#FFC93C' : 'none'}
      stroke={filled ? '#FFC93C' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function MinusIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function FitScreenIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </BaseIcon>
  );
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </BaseIcon>
  );
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <BaseIcon size={size}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </BaseIcon>
  );
}


