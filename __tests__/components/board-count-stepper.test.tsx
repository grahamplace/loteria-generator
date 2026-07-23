import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardCountStepper } from '@/components/board-count-stepper';
import {
  DEFAULT_EXPORT_BOARD_COUNT,
  MIN_EXPORT_BOARD_COUNT,
  MAX_EXPORT_BOARD_COUNT,
} from '@/lib/constants';

const LABEL = 'Number of boards';

/**
 * Mirrors how both real consumers use the stepper: the parent holds the count in
 * state and applies every change. Tests that care about stepping behavior need
 * this rather than a bare vi.fn(), which models a parent that drops changes.
 */
function ControlledStepper({
  initialValue = DEFAULT_EXPORT_BOARD_COUNT,
  onChange,
}: {
  initialValue?: number;
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <BoardCountStepper
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      label={LABEL}
    />
  );
}

describe('BoardCountStepper', () => {
  const defaultProps = {
    value: DEFAULT_EXPORT_BOARD_COUNT,
    onChange: vi.fn(),
    label: LABEL,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the current value', () => {
    render(<BoardCountStepper {...defaultProps} />);

    expect(screen.getByRole('spinbutton', { name: LABEL })).toHaveValue(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should expose accessible names for the group and both buttons', () => {
    render(<BoardCountStepper {...defaultProps} />);

    expect(screen.getByRole('group', { name: LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `− ${LABEL}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `+ ${LABEL}` })).toBeInTheDocument();
  });

  it('should call onChange with value + 1 when the increment button is clicked', () => {
    const onChange = vi.fn();
    render(<BoardCountStepper {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: `+ ${LABEL}` }));

    expect(onChange).toHaveBeenCalledWith(DEFAULT_EXPORT_BOARD_COUNT + 1);
  });

  it('should call onChange with value − 1 when the decrement button is clicked', () => {
    const onChange = vi.fn();
    render(<BoardCountStepper {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: `− ${LABEL}` }));

    expect(onChange).toHaveBeenCalledWith(DEFAULT_EXPORT_BOARD_COUNT - 1);
  });

  it('should disable the increment button at the maximum', () => {
    render(<BoardCountStepper {...defaultProps} value={MAX_EXPORT_BOARD_COUNT} />);

    expect(screen.getByRole('button', { name: `+ ${LABEL}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `− ${LABEL}` })).not.toBeDisabled();
  });

  it('should disable the decrement button at the minimum', () => {
    render(<BoardCountStepper {...defaultProps} value={MIN_EXPORT_BOARD_COUNT} />);

    expect(screen.getByRole('button', { name: `− ${LABEL}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `+ ${LABEL}` })).not.toBeDisabled();
  });

  it('should disable every control when disabled is set', () => {
    render(<BoardCountStepper {...defaultProps} disabled />);

    expect(screen.getByRole('button', { name: `− ${LABEL}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `+ ${LABEL}` })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: LABEL })).toBeDisabled();
  });

  it('should not block typing an out-of-range value and should clamp it on blur', () => {
    const onChange = vi.fn();
    render(<ControlledStepper onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: LABEL });
    const typed = MAX_EXPORT_BOARD_COUNT + 999;

    fireEvent.change(input, { target: { value: String(typed) } });

    // Typing is never blocked: the raw text is displayed as entered.
    expect(input).toHaveValue(typed);
    expect(onChange).toHaveBeenLastCalledWith(typed);

    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(MAX_EXPORT_BOARD_COUNT);
    expect(input).toHaveValue(MAX_EXPORT_BOARD_COUNT);
  });

  it('should allow a transient empty value and resolve it on blur', () => {
    const onChange = vi.fn();
    render(<ControlledStepper initialValue={MIN_EXPORT_BOARD_COUNT} onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: LABEL });

    fireEvent.change(input, { target: { value: '' } });

    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should clamp on Enter', () => {
    const onChange = vi.fn();
    render(<ControlledStepper onChange={onChange} />);

    const input = screen.getByRole('spinbutton', { name: LABEL });

    fireEvent.change(input, { target: { value: String(MIN_EXPORT_BOARD_COUNT - 5) } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(MIN_EXPORT_BOARD_COUNT);
    expect(input).toHaveValue(MIN_EXPORT_BOARD_COUNT);
  });

  it('should compound rapid clicks instead of coalescing them into one step', () => {
    // Clicks can land before the parent re-renders with the new value. Stepping
    // from the `value` prop would then read the same stale number every time and
    // turn three clicks into a single increment.
    const onChange = vi.fn();
    render(<ControlledStepper onChange={onChange} />);

    const increment = screen.getByRole('button', { name: `+ ${LABEL}` });
    fireEvent.click(increment);
    fireEvent.click(increment);
    fireEvent.click(increment);

    expect(onChange).toHaveBeenNthCalledWith(3, DEFAULT_EXPORT_BOARD_COUNT + 3);
    expect(screen.getByRole('spinbutton', { name: LABEL })).toHaveValue(
      DEFAULT_EXPORT_BOARD_COUNT + 3
    );
  });

  it('should stop stepping at the ceiling no matter how many clicks arrive', () => {
    const onChange = vi.fn();
    render(<ControlledStepper initialValue={MAX_EXPORT_BOARD_COUNT - 1} onChange={onChange} />);

    const increment = screen.getByRole('button', { name: `+ ${LABEL}` });
    for (let i = 0; i < 10; i++) {
      fireEvent.click(increment);
    }

    expect(onChange).not.toHaveBeenCalledWith(MAX_EXPORT_BOARD_COUNT + 1);
    expect(screen.getByRole('spinbutton', { name: LABEL })).toHaveValue(MAX_EXPORT_BOARD_COUNT);
  });

  it('should leave the value alone when the parent ignores onChange', () => {
    // Controlled-component semantics: the parent owns the value, so a parent
    // that drops the change must not see the stepper drift on its own.
    render(<BoardCountStepper {...defaultProps} onChange={vi.fn()} />);

    const increment = screen.getByRole('button', { name: `+ ${LABEL}` });
    fireEvent.click(increment);
    fireEvent.click(increment);

    expect(screen.getByRole('spinbutton', { name: LABEL })).toHaveValue(DEFAULT_EXPORT_BOARD_COUNT);
  });

  it('should sync the displayed text when the value prop changes from outside', () => {
    const { rerender } = render(<BoardCountStepper {...defaultProps} />);

    rerender(<BoardCountStepper {...defaultProps} value={MAX_EXPORT_BOARD_COUNT} />);

    expect(screen.getByRole('spinbutton', { name: LABEL })).toHaveValue(MAX_EXPORT_BOARD_COUNT);
  });
});
