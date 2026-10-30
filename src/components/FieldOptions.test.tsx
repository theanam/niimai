import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDoc, type LabelDoc } from '../doc/model';
import { FieldOptions } from './FieldOptions';

const show = (field: string, doc: LabelDoc = createDoc()) => {
  const onChange = vi.fn();
  const onSequence = vi.fn();
  const onAddSheet = vi.fn();
  render(<FieldOptions field={field} doc={doc} onChange={onChange} onSequence={onSequence} onAddSheet={onAddSheet} />);
  return { onChange, onSequence, onAddSheet };
};

describe('field options', () => {
  it('picks a date format from a list that shows each one', async () => {
    const { onChange } = show('Date+30');
    const formats = screen.getByRole('radiogroup', { name: 'Date format' });
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(within(formats).getByRole('radio', { checked: true })).toHaveTextContent('Day month year');
    await userEvent.click(within(formats).getByRole('radio', { name: /ISO/ }));
    expect(onChange).toHaveBeenLastCalledWith('Date+30:iso');
  });

  it('sets days from today with the stepper, typing or a preset', async () => {
    const { onChange } = show('Date+30');
    await userEvent.click(screen.getByRole('button', { name: 'More days from today' }));
    expect(onChange).toHaveBeenLastCalledWith('Date+31');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Days from today' }), { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith('Date+7');
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith('Date');
  });

  it('sets a 12- or 24-hour time', async () => {
    const { onChange } = show('Time');
    await userEvent.click(screen.getByRole('radio', { name: /24-hour/ }));
    expect(onChange).toHaveBeenLastCalledWith('Time:24h');
  });

  it('sets where numbers start and end, and says how many labels that is', async () => {
    const { onSequence } = show('Number', { ...createDoc(), sequence: { start: 1, step: 1, digits: 3, end: 50 } });
    expect(screen.getByText('001 – 050')).toBeInTheDocument();
    expect(screen.getByText(/^50 labels\./)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'End' }), { target: { value: '' } });
    expect(onSequence).toHaveBeenLastCalledWith({ start: 1, step: 1, digits: 3, end: undefined });
    await userEvent.click(screen.getByRole('button', { name: 'More digits' }));
    expect(onSequence).toHaveBeenLastCalledWith({ start: 1, step: 1, digits: 4, end: 50 });
  });

  it('switches a field to another column, showing each one with its first value', async () => {
    const sheet = { name: 's.csv', columns: ['Name', 'City'], rows: [['Jo', 'Oslo']] };
    const { onChange } = show('Name', { ...createDoc(), sheet });
    await userEvent.click(screen.getByRole('radio', { name: /City.*Oslo/ }));
    expect(onChange).toHaveBeenLastCalledWith('City');
  });

  it('offers to add a sheet when there is none', async () => {
    const { onAddSheet } = show('Name');
    await userEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    expect(onAddSheet).toHaveBeenCalled();
  });
});
