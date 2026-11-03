import { connectErrorTopic, type SetupTopic, type SupportIssue } from 'libniimai';
import { toast } from 'sonner';

/** The Help page, scrolled to the topic that shows how to get a connection working. */
export const setupHref = (topic: SetupTopic) => `#/help/${topic}`;

/** Why a connection is unavailable here, with a link to the fix. */
export function SupportNote({ issue, className = 'muted small' }: { issue: SupportIssue; className?: string }) {
  return (
    <p className={className}>
      {issue.reason}. <a href={setupHref(issue.topic)}>How to fix</a>
    </p>
  );
}

/** Shows a failed connect, with a way to the fix when the browser is the cause. */
export function connectFailed(err: unknown) {
  const topic = connectErrorTopic(err);
  toast.error((err as Error).message, topic ? { action: { label: 'How to fix', onClick: () => (window.location.hash = setupHref(topic)) } } : undefined);
}
