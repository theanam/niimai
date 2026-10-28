import * as Tooltip from '@radix-ui/react-tooltip';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ConfirmProvider } from '../ui/Dialog';

/** Renders with the providers the app shell supplies. */
export const renderApp = (ui: ReactElement) =>
  render(
    <Tooltip.Provider>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </Tooltip.Provider>,
  );
