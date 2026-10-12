"use client";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { useApiResource } from "@/hooks/use-api-resource";
import { PeerRoom } from "@/components/peer/room";
function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => api.getPeerSession(id), [id]);
  const state = useApiResource(load);
  return (
    <PageShell>
      {state.loading ? (
        <LoadingState label="Loading peer interview" />
      ) : state.missing ? (
        <StatePanel
          title="Peer interview not found"
          description="This room doesn't exist or isn't available to you."
          action={
            <Link
              href="/peer"
              className={buttonStyles({ variant: "secondary" })}
            >
              Peer interviews
            </Link>
          }
        />
      ) : state.error ? (
        <StatePanel
          tone="error"
          title="Could not load the room"
          description={state.error}
          action={<Button onClick={state.reload}>Retry room</Button>}
        />
      ) : (
        state.data && <PeerRoom key={id} initialSession={state.data.session} />
      )}
    </PageShell>
  );
}
export default function PeerRoomPage() {
  return (
    <Protected>
      <RoomPage />
    </Protected>
  );
}
