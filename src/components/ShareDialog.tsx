import { Check, Copy, Share2, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { LabelDoc } from '../doc/model';
import { LONG_LINK, shareUrl } from '../files/share';
import { Dialog } from '../ui/Dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: LabelDoc;
}

/** A link that opens a copy of the label. The label travels inside it, so nothing is uploaded. */
export function ShareDialog({ open, onOpenChange, doc }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setUrl(null);
    setCopied(false);
    shareUrl(doc)
      .then((u) => live && setUrl(u))
      .catch(() => live && toast.error('Could not make a link for this label'));
    return () => {
      live = false;
    };
  }, [open, doc]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error('Copy the link from the box');
    }
  };
  const canShare = typeof navigator.share === 'function';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share label" description="Anyone with the link gets a copy of this label. The label travels inside the link, so nothing is uploaded.">
      <div className="share-body">
        <input className="text-input share-link" aria-label="Share link" readOnly value={url ?? 'Making the link…'} onFocus={(e) => e.currentTarget.select()} />
        <div className="share-actions">
          <button className="btn btn-primary" onClick={() => void copy()} disabled={!url}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </button>
          {canShare && (
            <button className="btn" disabled={!url} onClick={() => url && void navigator.share({ title: doc.name, url }).catch(() => {})}>
              <Share2 size={16} /> Share
            </button>
          )}
        </div>
        {url && url.length > LONG_LINK && (
          <p className="muted small share-long" role="status">
            <TriangleAlert size={14} aria-hidden="true" /> Pictures make this link long, and some apps cut long links short. Save a file to send it whole.
          </p>
        )}
      </div>
    </Dialog>
  );
}
