// One-shot handoff for "a conversation was just forked elsewhere (e.g. from
// a shared-chat link) -- select it when the Chat screen next gains focus."
// A plain in-memory singleton is enough: it only needs to survive the
// single navigation from SharedConversationScreen to the Chat tab within
// the same session, not a reload or app restart.
let pendingConversationId: string | null = null;

export const setPendingConversationId = (id: string) => {
  pendingConversationId = id;
};

export const consumePendingConversationId = (): string | null => {
  const id = pendingConversationId;
  pendingConversationId = null;
  return id;
};
