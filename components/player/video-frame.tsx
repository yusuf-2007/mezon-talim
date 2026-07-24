import { getLocale, getTranslations } from "next-intl/server";
import { signPlaybackToken } from "@/lib/video";
import { pickLocale } from "@/lib/i18n/localized";
import type { videoQuestionsRepository } from "@/lib/db/repositories/video-questions";
import { VideoEmbed } from "./video-embed";

type QuestionRows = Awaited<
  ReturnType<typeof videoQuestionsRepository.listForLessonWithAnswers>
>;

/**
 * Bunny Stream iframe with a signed, expiring playback URL (view-only, no
 * downloads). Speed control + subtitles are native to the Bunny player UI, so
 * they come for free inside the iframe. Falls back to a placeholder when the
 * lesson has no video yet. In-video questions are serialized here WITHOUT
 * their correct answers (revealed only by the answer action).
 */
export async function VideoFrame({
  bunnyVideoId,
  title,
  videoQuestions = [],
  durationSeconds = null,
}: {
  bunnyVideoId: string | null;
  title: string;
  videoQuestions?: QuestionRows;
  durationSeconds?: number | null;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Player"),
    getLocale(),
  ]);

  if (!bunnyVideoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-navy-900 text-navy-100">
        {t("noVideo")}
      </div>
    );
  }

  const playback = signPlaybackToken(bunnyVideoId);

  return (
    <VideoEmbed
      key={playback.url}
      src={playback.url}
      title={title}
      initialDuration={durationSeconds ?? 0}
      questions={videoQuestions.map((q) => ({
        id: q.id,
        t: q.timestampSeconds,
        prompt: pickLocale(q.prompt, locale) ?? "",
        options: q.options.map((o) => pickLocale(o, locale) ?? ""),
        answered: q.answeredIndex != null,
      }))}
    />
  );
}
