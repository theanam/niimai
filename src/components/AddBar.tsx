import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import type { ElementType, LabelElement } from '../doc/model';
import { IconButton } from '../ui/IconButton';
import { ELEMENT_META, ELEMENT_ORDER } from './elementMeta';
import { FramePicker } from './FramePicker';

export function AddBar({ onAdd }: { onAdd: (type: ElementType, extra?: Partial<LabelElement>) => void }) {
  const [framesOpen, setFramesOpen] = useState(false);
  return (
    <nav className="add-bar" aria-label="Add element">
      {ELEMENT_ORDER.map((type) => {
        const { label, icon: Icon } = ELEMENT_META[type];
        if (type === 'frame') {
          return (
            <Popover.Root key={type} open={framesOpen} onOpenChange={setFramesOpen}>
              <Popover.Trigger asChild>
                <IconButton label={`Add ${label.toLowerCase()}`} active={framesOpen}>
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
          <IconButton key={type} label={`Add ${label.toLowerCase()}`} onClick={() => onAdd(type)}>
            <Icon size={20} />
          </IconButton>
        );
      })}
    </nav>
  );
}
