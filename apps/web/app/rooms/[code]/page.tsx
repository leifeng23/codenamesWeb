import { redirect } from "next/navigation";
import { RoomClient } from "../../../components/room-client";
import { Starfield } from "../../../components/starfield";
import { SoundProvider } from "../../../components/sound-provider";
import { currentUser } from "../../../lib/auth";
import { buildRoomSnapshot } from "../../../lib/game-state";
import { prisma } from "../../../lib/prisma";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: Props) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { code } = await params;
  const roomCode = code.toUpperCase();
  const room = await prisma.room.findUnique({ where: { code: roomCode }, include: { members: true } });
  if (!room) redirect("/");
  if (!room.members.some((member) => member.userId === user.id)) {
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
        team: "spectator",
        canSpy: false
      }
    });
  }
  const snapshot = await buildRoomSnapshot(roomCode, user.id);
  if (!snapshot) redirect("/");

  return (
    <SoundProvider>
      <main className="min-h-screen px-3 py-5 md:px-6">
        <Starfield />
        <RoomClient
          initialSnapshot={snapshot}
          roomId={room.id}
          roomCode={roomCode}
          userId={user.id}
          realtimeUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001"}
        />
      </main>
    </SoundProvider>
  );
}
