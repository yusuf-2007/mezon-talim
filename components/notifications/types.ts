/** Serialized notification shared by the bell dropdown and /notifications. */
export type BellItem = {
  id: string;
  type: string;
  actorName: string | null;
  lessonTitle: string | null;
  excerpt: string | null;
  read: boolean;
  createdAt: string;
  href: string;
};
