import type { ElementType } from '../doc/model';
import { IconButton } from '../ui/IconButton';
import { ELEMENT_META, ELEMENT_ORDER } from './elementMeta';

export function AddBar({ onAdd }: { onAdd: (type: ElementType) => void }) {
  return (
    <nav className="add-bar" aria-label="Add element">
      {ELEMENT_ORDER.map((type) => {
        const { label, icon: Icon } = ELEMENT_META[type];
        return (
          <IconButton key={type} label={`Add ${label.toLowerCase()}`} onClick={() => onAdd(type)}>
            <Icon size={20} />
          </IconButton>
        );
      })}
    </nav>
  );
}
