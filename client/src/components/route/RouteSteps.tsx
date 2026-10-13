import type { Floor } from '../../types/building';
import type { RouteNode } from '../../types/navigation';
import { getFloorName } from '../../utils/floors';
import { splitPathByFloor } from '../../utils/route';
import { AccessibleIcon, ChatIcon, ElevatorIcon, FlagIcon, ShieldIcon } from '../ui/Icons';
import './RouteSteps.css';

interface RouteStepsProps {
  path: RouteNode[];
  floors: Floor[];
  destinationLabel: string;
  stepIndex: number;
  isShelterRoute: boolean;
  accessible?: boolean;
  onToggleAccessible?: () => void;
  onStepChange: (stepIndex: number, floor: number) => void;
  onEnd: () => void;
  onOpenChat: () => void;
}

// Every floor on the route is one step. Between steps the visitor changes floor.
function RouteSteps({
  path,
  floors,
  destinationLabel,
  stepIndex,
  isShelterRoute,
  accessible = false,
  onToggleAccessible,
  onStepChange,
  onEnd,
  onOpenChat,
}: RouteStepsProps) {
  const segments = splitPathByFloor(path);
  const step = segments[stepIndex];
  const stepFloor = step[0].floor;
  const isLastStep = stepIndex === segments.length - 1;
  const nextFloor = isLastStep ? null : segments[stepIndex + 1][0].floor;

  let title: string;
  let subtitle: string;

  // The floor name is never glued to a Hebrew prefix ("ב...", "ל..."): the admin may have named it in English
  if (nextFloor === null) {
    title = `לכו אל ${destinationLabel}`;
    subtitle = `עקבו אחרי הקו הכחול · ${getFloorName(floors, stepFloor)}`;
  } else {
    const direction = nextFloor > stepFloor ? 'עלו' : 'רדו';
    title = `${direction} אל ${getFloorName(floors, nextFloor)}`;
    subtitle = accessible
      ? 'עקבו אחרי הקו הכחול עד המעלית.'
      : 'עקבו אחרי הקו הכחול עד המעלית או המדרגות.';
  }

  let nextStepText: string | null = null;
  if (nextFloor !== null) {
    const isNextLast = stepIndex + 1 === segments.length - 1;
    nextStepText = isNextLast
      ? `${getFloorName(floors, nextFloor)}: לכו אל ${destinationLabel}.`
      : `${getFloorName(floors, nextFloor)}: המשיכו לעקוב אחרי הקו.`;
  }

  let icon = <ElevatorIcon size={24} />;
  if (isLastStep) {
    icon = isShelterRoute ? <ShieldIcon size={24} /> : <FlagIcon size={24} />;
  }

  return (
    <div className="route-steps">
      <div className="route-steps-progress">
        <span className="route-steps-count">
          שלב {stepIndex + 1} מתוך {segments.length}
        </span>
        {onToggleAccessible && (
          <button
            type="button"
            className={`route-accessible-toggle ${accessible ? 'is-active' : ''}`}
            onClick={onToggleAccessible}
            aria-pressed={accessible}
            title={accessible ? 'מסלול נגיש (מעליות בלבד)' : 'החלף למסלול נגיש (מעליות בלבד)'}
          >
            <AccessibleIcon size={16} />
            <span>{accessible ? 'מסלול נגיש' : 'מסלול רגיל'}</span>
          </button>
        )}
        <div className="route-steps-bars">
          {segments.map((_, index) => (
            <span key={index} className={index <= stepIndex ? 'is-done' : ''} />
          ))}
        </div>
      </div>

      <div className="route-steps-current">
        <div className={isShelterRoute ? 'route-steps-icon is-shelter' : 'route-steps-icon'}>{icon}</div>
        <div>
          <div className="route-steps-title">{title}</div>
          <div className="route-steps-subtitle">{subtitle}</div>
        </div>
      </div>

      {nextStepText && (
        <div className="route-steps-next">
          <span className="route-steps-number">{stepIndex + 2}</span>
          <span>{nextStepText}</span>
        </div>
      )}

      <div className="sheet-actions">
        {nextFloor !== null ? (
          <button type="button" className="btn btn-primary" onClick={() => onStepChange(stepIndex + 1, nextFloor)}>
            הגעתי אל {getFloorName(floors, nextFloor)}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onEnd}>
            סיום המסלול
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onOpenChat}>
          <ChatIcon />
          צ׳אט
        </button>
      </div>
    </div>
  );
}

export default RouteSteps;
