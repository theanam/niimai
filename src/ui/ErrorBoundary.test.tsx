import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom');
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('contains a crash to its panel and keeps siblings alive', () => {
    render(
      <>
        <ErrorBoundary name="Canvas">
          <Bomb explode />
        </ErrorBoundary>
        <p>sibling</p>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Canvas stopped working');
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    expect(screen.getByText('sibling')).toBeInTheDocument();
  });

  it('recovers on retry', async () => {
    function Harness() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button onClick={() => setExplode(false)}>fix</button>
          <ErrorBoundary name="Panel">
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByText('fix'));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('fine')).toBeInTheDocument();
  });
});
