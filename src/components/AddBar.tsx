import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState } from 'react';
import type { ElementType, LabelElement } from '../doc/model';
import { IconButton } from '../ui/IconButton';
import { ELEMENT_META, ELEMENT_ORDER } from './elementMeta';
import { FramePicker } from './FramePicker';

/** "Add text", "Add QR code": lower-case words, acronyms kept. */
const addLabel = (label: string) => `Add ${label.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}`;

const NARROW = '(max-width: 640px)';

/** The bar runs down the side, or across the top on narrow screens. */
function useTooltipSide(): 'right' | 'bottom' {
  const query = (): 'right' | 'bottom' => (typeof matchMedia === 'function' && matchMedia(NARROW).matches ? 'bottom' : 'right');
  const [side, setSide] = useState(query);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(NARROW);
    const onChange = () => setSide(query());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return side;
}

export function AddBar({ onAdd }: { onAdd: (type: ElementType, extra?: Partial<LabelElement>) => void }) {
  const [framesOpen, setFramesOpen] = useState(false);
  const side = useTooltipSide();
  return (
    <nav className="add-bar" aria-label="Add element">
      {ELEMENT_ORDER.map((type) => {
        const { label, icon: Icon } = ELEMENT_META[type];
        if (type === 'frame') {
          return (
            <Popover.Root key={type} open={framesOpen} onOpenChange={setFramesOpen}>
              <Popover.Trigger asChild>
                <IconButton label={addLabel(label)} side={side} active={framesOpen}>
                  <Icon size={20} />
                </IconButton>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="popover frame-menu" side="right" align="start" sideOffset={8} collisionPadding={8}>
                  <FramePicker
                    onPick={(style) => {
                      onAdd('frame', { style } as Partial<LabelElement>);
                      setFramesOpen(false);
                    }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          );
        }
        return (
          <IconButton key={type} label={addLabel(label)} side={side} onClick={() => onAdd(type)}>
            <Icon size={20} />
          </IconButton>
        );
      })}
    </nav>
  );
}
