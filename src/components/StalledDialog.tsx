import { Dialog } from '../ui/Dialog';

/** The print errors a stuck printer gives: it stopped answering, or never confirmed the label. */
export const isStalled = (message: string): boolean => /stopped responding|did not confirm the print/i.test(message);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** What to do when the printer stops answering mid-print: a restart and a reseated roll clear it. */
export function StalledDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Printer stopped responding"
      description="Printers sometimes stall, often while they find the label gaps after the roll has moved."
      footer={
        <button className="btn btn-primary" onClick={() => onOpenChange(false)} autoFocus>
          Done
        </button>
      }
    >
      <ol className="mg-steps">
        <li>
          <strong>Turn the printer off and on.</strong>
        </li>
        <li>
          <strong>Open the lid, reseat the roll and close it.</strong> The printer may feed a label or two to find the gaps.
        </li>
        <li>
          <strong>Connect and print again.</strong>
        </li>
      </ol>
    </Dialog>
  );
}
