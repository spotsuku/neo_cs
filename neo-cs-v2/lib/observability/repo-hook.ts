/**
 * リポジトリ層 構造化ログフック
 *
 * audit.ts と同じ MutationHook 契約を実装し、01側 _base.ts で
 *   registerHook(auditHook)
 *   registerHook(loggingHook)
 * の2行で監査+構造化ログが両立する設計。
 *
 * audit_logs はDBに永続化、logger は stderr/Sentry/外部ログ集約に流す
 * 棲み分け。レイテンシや成否はこちらで記録 (audit には載せない)。
 */

import 'server-only';
import { getLogger } from './logger';
import type { MutationHook } from '@/lib/repository/audit';

export const loggingHook: MutationHook = {
  async afterWrite({ entityType, entityId, action, ctx }) {
    const log = await getLogger();
    log.info(
      {
        kind: 'repo.write',
        entityType,
        entityId,
        action,
        actorUserId: ctx.actor.userId,
        orgId: ctx.actor.organizationId,
        requestId: ctx.request.id,
      },
      `${entityType}.${action}`,
    );
  },
};
