// Server-only: the video meeting room link, from MEET_LINK (read at runtime,
// never inlined into any bundle). Never import this from client code, and
// never rename the variable to NEXT_PUBLIC_* — that would ship the link to
// every browser. Customers only receive it from the join endpoint once their
// meeting has started; staff via /api/appointments/meeting-room.
export function meetingRoomUrl() {
  return process.env.MEET_LINK || ""
}
