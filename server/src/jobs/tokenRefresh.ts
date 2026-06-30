import { Agenda } from "agenda";
import { nombaService } from "../services/nomba.service.js";
import { logger } from "../utils/logger.js";

/**
 * Token Refresh Job — Keeps the Nomba access token warm.
 *
 * Per AGENTS.md §2.3:
 * "Access tokens issued via /v1/auth/token/issue expire in 30 minutes.
 *  We must cache this token and use jobs/tokenRefresh.ts to refresh it
 *  every 25 minutes using the refresh token."
 *
 * This job runs every 25 minutes and proactively refreshes the token
 * before it expires, ensuring that billing scan and dunning retry jobs
 * never encounter an expired token.
 */

export const TOKEN_REFRESH_JOB_NAME = "refresh-nomba-token";

export function defineTokenRefreshJob(agenda: Agenda): void {
  agenda.define(TOKEN_REFRESH_JOB_NAME, async (_job) => {
    try {
      if (!nombaService.isConfigured()) {
        logger.warn(
          "Nomba credentials not configured — skipping token refresh"
        );
        return;
      }

      const result = await nombaService.refreshAccessToken();

      logger.info(
        { expiresIn: result.expiresIn },
        "Nomba token refreshed by scheduled job"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to refresh Nomba token in scheduled job"
      );
      // Don't rethrow — Agenda will retry the job on next schedule
    }
  });
}
