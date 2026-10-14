import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { HeaderSlotContext } from './headerSlot';

/** Renders its children into the shell header. Renders nothing until the header exists. */
export function HeaderControls({ children }: { children: ReactNode }): React.JSX.Element | null {
  const slot = useContext(HeaderSlotContext);
  return slot ? createPortal(children, slot) : null;
}
