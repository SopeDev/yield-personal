import { LoadingLabel } from "@/components/loading-label";
import { Card } from "@/components/section";

/** A block of placeholder content that pulses while the screen loads. */
function Bone({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block rounded-md bg-border/70 ${className}`} />;
}

/**
 * Shown instantly when moving between screens, while the server renders the next one. Shaped like the app's
 * screens (title bar, summary card, list) so the layout doesn't jump when content arrives.
 */
export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-7 motion-safe:animate-pulse" role="status">
      <LoadingLabel />
      <div className="flex items-center justify-between">
        <Bone className="size-11 rounded-full" />
        <Bone className="h-6 w-40" />
        <Bone className="size-11 rounded-full" />
      </div>

      <Card>
        <div className="flex flex-col items-center gap-2 border-b border-border px-4 py-4">
          <Bone className="h-3 w-16" />
          <Bone className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-border [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-border">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="flex flex-col items-center gap-2 px-2 py-3" key={index}>
              <Bone className="h-3 w-14" />
              <Bone className="h-5 w-24" />
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <Bone className="h-3 w-24" />
        <Card>
          <ul className="divide-y divide-border">
            {Array.from({ length: 4 }, (_, index) => (
              <li className="flex items-center gap-3 py-3 pl-4 pr-3" key={index}>
                <Bone className="size-2.5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-32" />
                  <Bone className="h-3 w-24" />
                </div>
                <Bone className="h-4 w-20" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
