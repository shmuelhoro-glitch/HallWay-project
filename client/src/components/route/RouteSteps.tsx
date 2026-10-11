import type { Floor } from '../../types/building';
import type { RouteNode } from '../../types/navigation';
import { getFloorName } from '../../utils/floors';
import { splitPathByFloor } from '../../utils/route';
import { ChatIcon, ElevatorIcon, FlagIcon, ShieldIcon } from '../ui/Icons';
import './RouteSteps.css';

interface RouteStepsProps {
  path: RouteNode[];
  floors: Floor[];
  destinationLabel: string;
  stepIndex: number;
  isShelterRoute: boolean;
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

  if (nextFloor === null) {
    title = `Walk to ${destinationLabel}`;
    subtitle = `Follow the blue line on ${getFloorName(floors, stepFloor)}.`;
  } else {
    const direction = nextFloor > stepFloor ? 'up' : 'down';
    title = `Go ${direction} to ${getFloorName(floors, nextFloor)}`;
    subtitle = 'Follow the blue line to the elevator or the stairs.';
  }

  let nextStepText: string | null = null;
  if (nextFloor !== null) {
    const isNextLast = stepIndex + 1 === segments.length - 1;
    nextStepText = isNextLast
      ? `On ${getFloorName(floors, nextFloor)}, walk to ${destinationLabel}.`
      : `On ${getFloorName(floors, nextFloor)}, keep following the line.`;
  }

  let icon = <ElevatorIcon size={24} />;
  if (isLastStep) {
    icon = isShelterRoute ? <ShieldIcon size={24} /> : <FlagIcon size={24} />;
  }

  return (
    <div className="route-steps">
      <div className="route-steps-progress">
        <span className="route-steps-count">
          Step {stepIndex + 1} of {segments.length}
        </span>
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
            I'm on {getFloorName(floors, nextFloor)}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onEnd}>
            End route
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onOpenChat}>
          <ChatIcon />
          Chat
        </button>
      </div>
    </div>
  );
}

export default RouteSteps;
