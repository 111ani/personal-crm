type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Reads the home page address: the search text and the selected group.
 * A group that is not in `groupIds` (deleted, or not an id at all) counts as
 * not selected, so the whole list shows. A repeated parameter is ignored
 */
export function parseHomeParams(
  params: SearchParams,
  groupIds: string[],
): { query: string; groupId: string | null } {
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const group = typeof params.group === "string" ? params.group : "";
  return { query, groupId: groupIds.includes(group) ? group : null };
}

/** The home page address for a search text and a group: `/?group=…&q=…` */
export function buildHomeUrl({
  q,
  group,
}: {
  q?: string | null;
  group?: string | null;
}) {
  const parts: string[] = [];
  if (group) {
    parts.push(`group=${encodeURIComponent(group)}`);
  }
  if (q) {
    parts.push(`q=${encodeURIComponent(q)}`);
  }
  return parts.length > 0 ? `/?${parts.join("&")}` : "/";
}
