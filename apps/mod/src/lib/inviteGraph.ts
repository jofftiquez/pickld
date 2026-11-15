import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { t } from '~/i18n/t';

// public.mod_invite_tree() and mod_invite_network() (0145): who brought in whom, for the console's invite graph.
// Moderators only; never used by the app or analytics (rules 9 and 10).
export const TREE_DEPTHS = [1, 2, 3, 4, 5, 6] as const;
export const DEFAULT_DEPTH = 3;

const Node = z.object({
  id: z.string(),
  type: z.enum(['person', 'waitlist', 'admin']),
  username: z.string().optional(),
  display_name: z.string().optional(),
  status: z.enum(['active', 'suspended', 'deleted', 'waiting']).optional(),
  frozen: z.boolean().optional(),
  code: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  level: z.number().optional(),
  direct: z.number(),
  total: z.number().nullable(),
});
export type GraphNode = z.infer<typeof Node>;

const Edge = z.object({ source: z.string(), target: z.string(), via_link: z.boolean(), joined_at: z.string() });
export type GraphEdge = z.infer<typeof Edge>;

const Tree = z.object({
  focus: z.uuid(),
  depth: z.number(),
  limit: z.number(),
  truncated: z.boolean(),
  nodes: z.array(Node),
  edges: z.array(Edge),
});
export type InviteTree = z.infer<typeof Tree>;

const Network = z.object({
  limit: z.number(),
  people: z.number(),
  truncated: z.boolean(),
  nodes: z.array(Node),
  edges: z.array(Edge),
});
export type InviteNetwork = z.infer<typeof Network>;

export async function loadInviteTree(client: SupabaseClient, id: string, depth: number): Promise<InviteTree | null> {
  const { data, error } = await client.rpc('mod_invite_tree', { p_user: id, p_depth: depth });
  if (error) throw new Error(error.message);
  return Tree.nullable().parse(data);
}

export async function loadInviteNetwork(client: SupabaseClient): Promise<InviteNetwork> {
  const { data, error } = await client.rpc('mod_invite_network');
  if (error) throw new Error(error.message);
  return Network.parse(data);
}

/** ?depth= as one of TREE_DEPTHS, else the default. */
export function treeDepth(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (TREE_DEPTHS as readonly number[]).includes(n) ? n : DEFAULT_DEPTH;
}

/** A node's name: @username, Waitlist or Code ABC123. */
export function nodeName(n: GraphNode): string {
  if (n.type === 'waitlist') return t('graph.waitlist');
  if (n.type === 'admin') return t('graph.admin', { code: n.code ?? '' });
  return `@${n.username ?? ''}`;
}
